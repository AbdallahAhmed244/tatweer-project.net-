using Microsoft.AspNetCore.SignalR;
using StockMarketTrackeratwatweer.Hubs;
using StockMarketTrackeratwatweer.Services;

namespace StockMarketTrackeratwatweer.Services
{
    public class StockPriceWorker : BackgroundService
    {
        private readonly IHubContext<StockHub> _hubContext;
        private readonly IServiceProvider _serviceProvider;

        public StockPriceWorker(IHubContext<StockHub> hubContext, IServiceProvider serviceProvider)
        {
            _hubContext = hubContext;
            _serviceProvider = serviceProvider;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using (var scope = _serviceProvider.CreateScope())
                    {
                        var repo = scope.ServiceProvider.GetRequiredService<StockRepository>();

                        var stocks = await repo.GetAllStocksAsync();

                        foreach (var stock in stocks)
                        {
                            try
                            {
                                // لو الرمز عملة رقمية (كريبتو) هات السعر من CoinGecko
                                // غير كده هات السعر من Finnhub (أسهم عادية)
                                decimal? price = repo.IsCrypto(stock.Symbol)
                                    ? await repo.GetCryptoPriceAsync(stock.Symbol)
                                    : await repo.GetRealStockPriceAsync(stock.Symbol);

                                if (price == null)
                                {
                                    Console.WriteLine($"[Worker] لم يتم إرجاع سعر لـ {stock.Symbol}");
                                    continue;
                                }

                                if (price.Value != stock.Price)
                                {
                                    await repo.UpdateStockPriceAsync(stock.Symbol, price.Value);
                                    await _hubContext.Clients.All.SendAsync(
                                        "ReceivePriceUpdate",
                                        stock.Symbol,
                                        price.Value,
                                        cancellationToken: stoppingToken);
                                }

                                // مهلة بسيطة بين كل نداء وآخر عشان الالتزام بحد Finnhub لعدد الطلبات (rate limit)
                                await Task.Delay(1200, stoppingToken);
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"[Worker Error - {stock.Symbol}]: {ex}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[Worker Error]: {ex.Message}");
                }

                await Task.Delay(10000, stoppingToken);
            }
        }
    }
}
