namespace StockMarketTrackeratwatweer.Models
{
    public class Stock
    {
        public int? Id { get; set; }
        public string Symbol { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal Price { get; set; }
        public DateTime? LastUpdated { get; set; }
    }
}