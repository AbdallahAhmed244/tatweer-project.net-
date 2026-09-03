using MySqlConnector;
using StockMarketTrackeratwatweer.Models;
using System.Text.Json;
using System.Text.Json.Serialization;
// System.Text.Json يوفر JsonDocument المستخدم في قراءة رد CoinGecko

namespace StockMarketTrackeratwatweer.Services
{
    // نموذج استجابة API من Finnhub
    public class FinnhubQuote
    {
        [JsonPropertyName("c")]
        public decimal CurrentPrice { get; set; } // المفتاح c يمثل السعر الحالي (Current Price)

        [JsonPropertyName("pc")]
        public decimal PreviousClose { get; set; }
    }

    public class StockRepository
    {
        private readonly string _connectionString;
        private readonly HttpClient _httpClient;
        private readonly string _finnhubApiKey;
        private readonly string _coinGeckoApiKey;

        public StockRepository(IConfiguration configuration, HttpClient httpClient)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection")
                ?? throw new InvalidOperationException("Connection string not found.");
            _httpClient = httpClient;

            // جلب المفتاح من appsettings.json أو استخدام القيمة الافتراضية
            _finnhubApiKey = configuration["Finnhub:ApiKey"] ?? "dacjgg1r01qk72tv12ogdacjgg1r01qk72tv12p0";

            // مفتاح CoinGecko Demo API (لازم يتبعت في header اسمه x-cg-demo-api-key)
            _coinGeckoApiKey = configuration["CoinGecko:ApiKey"] ?? string.Empty;
        }

        // ==========================================
        // خريطة الرموز اللي هي عملات رقمية (كريبتو) مش أسهم
        // Finnhub المجاني مش بيدعم أسعار الكريبتو، فبنجيبها من CoinGecko بدلاً منه
        // ==========================================
        private static readonly Dictionary<string, string> CryptoCoinGeckoIds =
     new(StringComparer.OrdinalIgnoreCase)
 {
    { "BITCOIN", "bitcoin" },
    { "BTC", "bitcoin" },

    { "ETHEREUM", "ethereum" },
    { "ETH", "ethereum" },

    { "DOGECOIN", "dogecoin" },
    { "DOGE", "dogecoin" },

    { "SOLANA", "solana" },
    { "SOL", "solana" },

    { "CARDANO", "cardano" },
    { "ADA", "cardano" },

    { "RIPPLE", "ripple" },
    { "XRP", "ripple" },

    { "CHAINLINK", "chainlink" },
    { "LINK", "chainlink" }
 };

        public bool IsCrypto(string symbol) => CryptoCoinGeckoIds.ContainsKey(symbol);

        // ==========================================
        // 0. جلب سعر عملة رقمية من CoinGecko
        // ==========================================
        public async Task<decimal?> GetCryptoPriceAsync(string symbol)
        {
            if (!CryptoCoinGeckoIds.TryGetValue(symbol, out var coinId))
                return null;

            var url = $"https://api.coingecko.com/api/v3/simple/price?ids={coinId}&vs_currencies=usd";

            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Get, url);

                // CoinGecko بقت لازم API key حتى للخطة المجانية (Demo Plan)
                // بيتبعت في header اسمه x-cg-demo-api-key
                if (!string.IsNullOrWhiteSpace(_coinGeckoApiKey))
                {
                    request.Headers.Add("x-cg-demo-api-key", _coinGeckoApiKey);
                }

                var response = await _httpClient.SendAsync(request);
                var json = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"[CoinGecko] {symbol} -> HTTP {(int)response.StatusCode} {response.StatusCode}. Body: {json}");
                    return null;
                }

                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty(coinId, out var coinObj) ||
                    !coinObj.TryGetProperty("usd", out var priceElement))
                {
                    Console.WriteLine($"[CoinGecko] {symbol} -> لم يتم العثور على السعر في الرد: {json}");
                    return null;
                }

                decimal price = priceElement.GetDecimal();
                Console.WriteLine($"[CoinGecko] {symbol} -> {price}");
                return price;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CoinGecko Error] فشل جلب سعر {symbol}: {ex.Message}");
                return null;
            }
        }

        // ==========================================
        // 1. جلب السعر الحقيقي المباشر من Finnhub API
        // ==========================================
        public async Task<decimal?> GetRealStockPriceAsync(string symbol)
        {
            var url = $"https://finnhub.io/api/v1/quote?symbol={symbol.ToUpper()}&token={_finnhubApiKey}";

            try
            {
                var response = await _httpClient.GetAsync(url);
                var json = await response.Content.ReadAsStringAsync();

                // ==== تشخيص مفصّل: هيوضح بالظبط ليه سهم معين مبيتحدثش ====
                if (!response.IsSuccessStatusCode)
                {
                    // Finnhub بيرجع 429 لو ضربت الـ rate limit (60 نداء/دقيقة)
                    Console.WriteLine(
                        $"[Finnhub] {symbol} -> HTTP {(int)response.StatusCode} {response.StatusCode}. Body: {json}");
                    return null;
                }

                if (string.IsNullOrWhiteSpace(json))
                {
                    Console.WriteLine($"[Finnhub] {symbol} -> رد فارغ من السيرفر.");
                    return null;
                }

                var quote = JsonSerializer.Deserialize<FinnhubQuote>(json);

                if (quote == null)
                {
                    Console.WriteLine($"[Finnhub] {symbol} -> تعذر تفسير الرد: {json}");
                    return null;
                }

                if (quote.CurrentPrice <= 0)
                {
                    // c=0 معناها إن Finnhub معندوش بيانات لسهم اسمه ده أصلاً
                    // (رمز غلط، أو رمز كريبتو مش مدعوم بالـ endpoint ده)
                    Console.WriteLine($"[Finnhub] {symbol} -> السعر راجع 0 (الرمز غير مدعوم أو غير صحيح). الرد الكامل: {json}");
                    return null;
                }

                Console.WriteLine($"[Finnhub] {symbol} -> {quote.CurrentPrice}");
                return quote.CurrentPrice;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[Finnhub Error] فشل جلب سعر {symbol}: {ex.Message}");
                return null;
            }
        }

        // ==========================================
        // 2. عمليات قاعدة البيانات MySQL (Async)
        // ==========================================

        // جلب جميع الأسهم من قاعدة البيانات
        public async Task<List<Stock>> GetAllStocksAsync()
        {
            var stocks = new List<Stock>();

            using (var conn = new MySqlConnection(_connectionString))
            {
                string query = "SELECT Id, Symbol, Name, Price, LastUpdated FROM Stocks";
                using (var cmd = new MySqlCommand(query, conn))
                {
                    await conn.OpenAsync();
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            stocks.Add(new Stock
                            {
                                Id = reader.GetInt32("Id"),
                                Symbol = reader.GetString("Symbol"),
                                Name = reader.GetString("Name"),
                                Price = reader.GetDecimal("Price"),
                                LastUpdated = reader.GetDateTime("LastUpdated")
                            });
                        }
                    }
                }
            }
            return stocks;
        }

        // تحديث سعر سهم في MySQL
        public async Task UpdateStockPriceAsync(string symbol, decimal newPrice)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                string query = "UPDATE Stocks SET Price = @Price, LastUpdated = NOW() WHERE Symbol = @Symbol";

                using (var cmd = new MySqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Price", newPrice);
                    cmd.Parameters.AddWithValue("@Symbol", symbol);

                    await conn.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();
                }
            }
        }

        // إضافة سهم جديد
        public async Task AddStockAsync(Stock stock)
        {
            stock.Name = stock.Symbol;
            using (var conn = new MySqlConnection(_connectionString))
            {
                string query = "INSERT INTO Stocks (Symbol, Name, Price) VALUES (@Symbol, @Name, @Price)";
                using (var cmd = new MySqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Symbol", stock.Symbol);
                    cmd.Parameters.AddWithValue("@Name", stock.Name);
                    cmd.Parameters.AddWithValue("@Price", stock.Price);

                    await conn.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();
                }
            }
        }

        // حذف سهم
        public async Task DeleteStockAsync(string symbol)
        {
            using (var conn = new MySqlConnection(_connectionString))
            {
                string query = "DELETE FROM Stocks WHERE Symbol = @Symbol";
                using (var cmd = new MySqlCommand(query, conn))
                {
                    cmd.Parameters.AddWithValue("@Symbol", symbol);

                    await conn.OpenAsync();
                    await cmd.ExecuteNonQueryAsync();
                }
            }
        }
    }
}
