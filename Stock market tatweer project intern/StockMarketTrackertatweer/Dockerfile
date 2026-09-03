FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# نسخ الملف وبناء الاعتمادات
COPY ["StockMarketTrackertatweer.csproj", "./"]
RUN dotnet restore "StockMarketTrackertatweer.csproj"

# نسخ الأكواد وعمل Publish
COPY . .
RUN dotnet publish "StockMarketTrackertatweer.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

EXPOSE 80
EXPOSE 443

ENTRYPOINT ["dotnet", "StockMarketTrackertatweer.dll"]