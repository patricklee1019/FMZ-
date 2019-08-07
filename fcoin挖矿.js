var depth,ask,bid;
var account;
var initBalance = 208.350; // 初始钱
var initStocks = 45.7257; // 初始币
var precision = 0.001;//    精度 最小单位
var checkBalanceCount = 0;
var profit = 0;
function checkBalance()
{
    cancelAllOrders();
    LogProfit(profit);
}
function cancelAllOrders()
{
    //exchange.SetContractType("quarter");
    var orders = _C(exchange.GetOrders);
    //Log(orders);
    for(var i in orders)
    {
        exchange.CancelOrder(orders[i].Id,orders[i]);
        Sleep(100);
    }
  
}
function work()
{
    account = _C(exchange.GetAccount);
    depth = _C(exchange.GetDepth);
    for(var i in depth.Asks)
    {
        ask = depth.Asks[i].Price;
        break;
    }
    for(var i in depth.Bids)
    {
        bid = depth.Bids[i].Price;
        break;
    }
    if( (account.Stocks+account.FrozenStocks) * bid > account.Balance + account.FrozenBalance)
    {
        //stocks too much
        bid -= 1*precision;
    }
    else 
    {
        ask += 1*precision;
    }
    if(account.Balance > 10)
    {
        exchange.Buy(_N(bid,3),_N(5/bid,2));
    }
    if(account.Stocks * bid > 10)
    {
        exchange.Sell(_N(ask,3),_N(5/ask,2));
    }
    profit = _N(account.Balance+account.FrozenBalance - initBalance + (account.Stocks+account.FrozenStocks-initStocks)*bid,3);
    var table = { 
        type: 'table', 
        title: '持仓操作', 
        cols: ['初币','初钱','总币','总钱','利润'], 
        rows: [ 
            [initStocks,initBalance,_N(account.Stocks+account.FrozenStocks,3),_N(account.Balance+account.FrozenBalance,3), profit],
            ['qq群540059246','代码地址','https://github.com/asvenslee/FMZ-','用完记得点个星星噢',''],
        ]
    }; 
    LogStatus('`' + JSON.stringify(table) + '`') 
    if(checkBalanceCount <= 0)
    {
        checkBalanceCount = 300;
        checkBalance();
    }
    else checkBalanceCount--;
}
function main() {
    //Log(exchange.GetAccount());
    cancelAllOrders();
    while(true)
    {
        Sleep(1000);
        try{
            work();
        }
        catch(e){
            Log(e);
        }
    }
}
