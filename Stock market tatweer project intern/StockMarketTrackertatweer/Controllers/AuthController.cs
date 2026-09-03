using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using MySqlConnector;
using StockMarketTrackeratwatweer.Models;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace StockMarketTrackeratwatweer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IConfiguration _config;
        private readonly string _connectionString;

        // إعدادات تشفير الباسورد (PBKDF2-HMACSHA256)
        private const int SaltSize = 16;      // 128-bit
        private const int KeySize = 32;       // 256-bit
        private const int Iterations = 100000;

        public AuthController(IConfiguration config)
        {
            _config = config;
            _connectionString = config.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string not found.");
        }

        // ==========================================
        // 1. تسجيل عام للجمهور (دائماً User)
        // ==========================================
        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("اسم المستخدم وكلمة المرور مطلوبين.");

            if (await UserExistsAsync(dto.Username))
                return BadRequest("اسم المستخدم موجود بالفعل.");

            // قفل الصلاحية لتكون User بغض النظر عما يرسله الفرونت إند
            await CreateUserAsync(dto.Username, dto.Password, "User");

            return Ok(new { message = "تم إنشاء حساب المستخدم بنجاح" });
        }

        // ==========================================
        // 2. إضافة أدمن جديد (حصرية للأدمن الحالي فقط)
        // ==========================================
        [HttpPost("create-admin")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateAdmin([FromBody] RegisterDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
                return BadRequest("اسم المستخدم وكلمة المرور مطلوبين.");

            if (await UserExistsAsync(dto.Username))
                return BadRequest("اسم المستخدم موجود بالفعل.");

            await CreateUserAsync(dto.Username, dto.Password, "Admin");

            return Ok(new { message = "تم إنشاء حساب الأدمن بنجاح" });
        }

        // ==========================================
        // 3. تسجيل الدخول
        // ==========================================
        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
                return Unauthorized("اسم المستخدم أو كلمة المرور غير صحيحة.");

            var user = await GetUserAsync(dto.Username);
            if (user == null || !VerifyPassword(dto.Password, user.Value.PasswordHash))
                return Unauthorized("اسم المستخدم أو كلمة المرور غير صحيحة.");

            var token = GenerateJwtToken(user.Value.Username, user.Value.Role);
            return Ok(new AuthResponseDto { Token = token, Username = user.Value.Username, Role = user.Value.Role });
        }

        // ==========================================
        // عمليات قاعدة البيانات (MySQL)
        // ==========================================

        private async Task<bool> UserExistsAsync(string username)
        {
            using var conn = new MySqlConnection(_connectionString);
            using var cmd = new MySqlCommand("SELECT COUNT(*) FROM Users WHERE Username = @Username", conn);
            cmd.Parameters.AddWithValue("@Username", username);

            await conn.OpenAsync();
            var count = Convert.ToInt32(await cmd.ExecuteScalarAsync());
            return count > 0;
        }

        private async Task CreateUserAsync(string username, string password, string role)
        {
            string passwordHash = HashPassword(password);

            using var conn = new MySqlConnection(_connectionString);
            using var cmd = new MySqlCommand(
                "INSERT INTO Users (Username, PasswordHash, Role) VALUES (@Username, @PasswordHash, @Role)", conn);

            cmd.Parameters.AddWithValue("@Username", username);
            cmd.Parameters.AddWithValue("@PasswordHash", passwordHash);
            cmd.Parameters.AddWithValue("@Role", role);

            await conn.OpenAsync();
            await cmd.ExecuteNonQueryAsync();
        }

        private async Task<(string Username, string PasswordHash, string Role)?> GetUserAsync(string username)
        {
            using var conn = new MySqlConnection(_connectionString);
            using var cmd = new MySqlCommand(
                "SELECT Username, PasswordHash, Role FROM Users WHERE Username = @Username", conn);
            cmd.Parameters.AddWithValue("@Username", username);

            await conn.OpenAsync();
            using var reader = await cmd.ExecuteReaderAsync();

            if (await reader.ReadAsync())
            {
                return (
                    reader.GetString("Username"),
                    reader.GetString("PasswordHash"),
                    reader.GetString("Role")
                );
            }

            return null;
        }

        // ==========================================
        // تشفير والتحقق من الباسورد (PBKDF2-HMACSHA256)
        // الصيغة المخزنة: {iterations}.{saltBase64}.{hashBase64}
        // ==========================================

        private static string HashPassword(string password)
        {
            byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
            byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password), salt, Iterations, HashAlgorithmName.SHA256, KeySize);

            return $"{Iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
        }

        private static bool VerifyPassword(string password, string storedHash)
        {
            var parts = storedHash.Split('.');
            if (parts.Length != 3)
                return false;

            int iterations = int.Parse(parts[0]);
            byte[] salt = Convert.FromBase64String(parts[1]);
            byte[] expectedHash = Convert.FromBase64String(parts[2]);

            byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
                Encoding.UTF8.GetBytes(password), salt, iterations, HashAlgorithmName.SHA256, expectedHash.Length);

            return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
        }

        // ==========================================
        // توليد JWT Token
        // ==========================================

        private string GenerateJwtToken(string username, string role)
        {
            var jwtKey = _config["Jwt:Key"] ?? "SuperSecretKeyForJWTAuthentication_StockApp_2026";
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var claims = new[]
            {
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role)
            };

            var token = new JwtSecurityToken(
                issuer: "StockApp",
                audience: "StockAppUsers",
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
