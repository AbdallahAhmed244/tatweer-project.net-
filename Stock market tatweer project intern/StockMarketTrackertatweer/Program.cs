using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;
using StockMarketTrackeratwatweer.Hubs;
using StockMarketTrackeratwatweer.Services;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 1. إضافة خدمات الـ Controllers والـ Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 2. تسجيل الـ HttpClient والـ Repository والـ SignalR والـ Background Worker
builder.Services.AddHttpClient();
builder.Services.AddScoped<StockRepository>();
builder.Services.AddSignalR();
builder.Services.AddHostedService<StockPriceWorker>();

// 3. تفعيل CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 4. إعداد الـ JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "SuperSecretKeyForJWTAuthentication_StockApp_2026";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "StockApp",
            ValidAudience = "StockAppUsers",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),

            // 🔴 السطران الحاسمان: تعريف السيرفر بقراءة الـ Role والـ Name من الـ JWT
            RoleClaimType = ClaimTypes.Role,
            NameClaimType = ClaimTypes.Name
        };

        // 🔴 دالة استقبال التوكن لـ SignalR عبر الـ URL Query
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/stockHub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

// ==========================================
// 5. تهيئة ذاتية لقاعدة البيانات (Self-healing DB init)
// بتتأكد إن جدول Users موجود، ولو مش موجود بتنشئه وتزرع
// حساب admin افتراضي فيه، بحيث تسجيل الدخول يشتغل حتى لو
// المستخدم نسي يعمل Import لملف الـ SQL يدويًا.
// ==========================================
await InitializeDatabaseAsync(app.Configuration);

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// ترتيب الميدل وير الصحيح
app.UseCors("AllowAll");
app.UseRouting();

app.UseAuthentication(); // أولاً: التحقق من التوكن
app.UseAuthorization();  // ثانياً: التحقق من الصلاحيات (User/Admin)

app.MapControllers();
app.MapHub<StockHub>("/stockHub");

app.Run();


// ==========================================
// دالة التهيئة الذاتية لقاعدة البيانات
// ==========================================
static async Task InitializeDatabaseAsync(IConfiguration configuration)
{
    var connectionString = configuration.GetConnectionString("DefaultConnection");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        Console.WriteLine("[DB Init] تحذير: مفيش connection string، تم تخطي التهيئة الذاتية.");
        return;
    }

    try
    {
        using var conn = new MySqlConnection(connectionString);
        await conn.OpenAsync();

        // 1. إنشاء جدول Users لو مش موجود
        const string createUsersTable = @"
            CREATE TABLE IF NOT EXISTS `Users` (
              `Id` int(11) NOT NULL AUTO_INCREMENT,
              `Username` varchar(50) NOT NULL,
              `PasswordHash` varchar(255) NOT NULL,
              `Role` varchar(20) NOT NULL DEFAULT 'User',
              `CreatedAt` datetime DEFAULT current_timestamp(),
              PRIMARY KEY (`Id`),
              UNIQUE KEY `Username` (`Username`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";

        using (var cmd = new MySqlCommand(createUsersTable, conn))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        // 2. إنشاء جدول Stocks لو مش موجود (احتياطي فقط)
        const string createStocksTable = @"
            CREATE TABLE IF NOT EXISTS `stocks` (
              `Id` int(11) NOT NULL AUTO_INCREMENT,
              `Symbol` varchar(10) NOT NULL,
              `Name` varchar(100) NOT NULL,
              `Price` decimal(18,2) NOT NULL,
              `LastUpdated` datetime DEFAULT current_timestamp() ON UPDATE current_timestamp(),
              PRIMARY KEY (`Id`),
              UNIQUE KEY `Symbol` (`Symbol`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;";

        using (var cmd = new MySqlCommand(createStocksTable, conn))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        // 3. التحقق: هل يوجد أي مستخدم بالفعل؟
        long userCount;
        using (var cmd = new MySqlCommand("SELECT COUNT(*) FROM Users", conn))
        {
            userCount = Convert.ToInt64(await cmd.ExecuteScalarAsync());
        }

        if (userCount == 0)
        {
            // زرع حساب admin افتراضي: admin / admin123
            string passwordHash = HashPassword("admin123");

            using var seedCmd = new MySqlCommand(
                "INSERT INTO Users (Username, PasswordHash, Role) VALUES (@Username, @PasswordHash, @Role)", conn);
            seedCmd.Parameters.AddWithValue("@Username", "admin");
            seedCmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
            seedCmd.Parameters.AddWithValue("@Role", "Admin");

            await seedCmd.ExecuteNonQueryAsync();

            Console.WriteLine("[DB Init] تم إنشاء حساب Admin افتراضي: admin / admin123");
        }
        else
        {
            Console.WriteLine($"[DB Init] جدول Users موجود بالفعل ({userCount} مستخدم).");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[DB Init Error] فشلت التهيئة الذاتية لقاعدة البيانات: {ex.Message}");
    }
}

// نفس خوارزمية التشفير المستخدمة في AuthController (PBKDF2-HMACSHA256)
static string HashPassword(string password)
{
    const int saltSize = 16;
    const int keySize = 32;
    const int iterations = 100000;

    byte[] salt = RandomNumberGenerator.GetBytes(saltSize);
    byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
        Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, keySize);

    return $"{iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
}
