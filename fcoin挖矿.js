var depth,ask,bid;
var account;
var initBalance = 208.350;
var initStocks = 45.7257;
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
        Sleep(500);
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
    if(account.Balance > 10)
    {
        exchange.Buy(bid,_N(10/bid,2));
    }
    if(account.Stocks * bid > 10)
    {
        exchange.Sell(ask,_N(10/ask,2));
    }
    profit = _N(account.Balance+account.FrozenBalance - initBalance + (account.Stocks+account.FrozenStocks-initStocks)*bid,3);
    var table = { 
        type: 'table', 
        title: '持仓操作', 
        cols: ['初币','初钱','总币','总钱','利润'], 
        rows: [ 
            [initStocks,initBalance,_N(account.Stocks+account.FrozenStocks,3),_N(account.Balance+account.FrozenBalance,3), profit],
            //['qq群540059246'],
        ]
    }; 
    LogStatus('`' + JSON.stringify(table) + '`') 
    if(checkBalanceCount <= 0)
    {
        checkBalanceCount = 1000;
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
