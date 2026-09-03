using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StockMarketTrackeratwatweer.Models;
using StockMarketTrackeratwatweer.Services;

namespace StockMarketTrackeratwatweer.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class StocksController : ControllerBase
    {
        private readonly StockRepository _repository;

        public StocksController(StockRepository repository)
        {
            _repository = repository;
        }

        // 1. جلب الأسهم (Async)
        [HttpGet]
        public async Task<IActionResult> GetStocks()
        {
            var stocks = await _repository.GetAllStocksAsync();
            return Ok(stocks);
        }

        // 2. إضافة سهم (Async)
        [HttpPost]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> AddStock([FromBody] Stock stock)
        {
            if (stock == null || string.IsNullOrEmpty(stock.Symbol))
                return BadRequest("بيانات السهم غير مكتملة.");

            await _repository.AddStockAsync(stock);
            return Ok(new { message = "تمت إضافة السهم بنجاح" });
        }

        // 3. حذف سهم (Async)
        [HttpDelete("{symbol}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> DeleteStock(string symbol)
        {
            await _repository.DeleteStockAsync(symbol);
            return Ok(new { message = "تم حذف السهم بنجاح" });
        }
    }
}