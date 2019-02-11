//5秒内持续上涨做多 持续下跌做空

var que = new Array();
var c = new Array(5);
var holdingLong = false;
var holdingShort = false;
var num = 5;
var account;
function visuallize()
{
    
    
    for(var i=1;i<num;i++)
    {
        if(que[i]>que[i-1])c[i]='#238E23';
        else if(que[i] == que[i-1])c[i]='#000000';
        else c[i]='#FF0000';
    }
    c[0]=c[1];
    var c0=c[0];var c1=c[1];var c2=c[2];var c3=c[3];var c4=c[4];
    var table = { 
        type: 'table', 
        title: '持仓信息', 
        cols: ['初始余额', '当前余额',''], 
        rows: [
            [0.8527,_N(account.account_rights,4),'','',''],
            [que[0]+c0,que[1]+c1,que[2]+c2,que[3]+c3,que[4]+c4],
        ]
            
    }; 
    //Log(que);
    LogStatus('`' + JSON.stringify(table) + '`');
}
function checkUp()
{
    for(var i = 1;i < num;i++)
    {
        if(que[i] <= que[i-1])return 0;
    }
    return 1;
}
function checkDown()
{
    for(var i = 1;i < num;i++)
    {
        if(que[i] >= que[i-1])return 0;
    }
    return 1;
}
function checkSignal()
{
    if(checkUp())return 1;
    if(checkDown())return -1;
    
    return 0;
    
}
var cnt = 0;
function work()
{
    account = _C(exchange.GetAccount).Info.info.eos;
    ticker = exchange.GetTicker();
    que.push(ticker.Last);
    cnt++;
    if(cnt > 5)
    {
        que.shift();
    }else return;
    var signal = checkSignal();
    if(signal == 1 && holdingLong == false)//做多
    {
        LogProfit(account.account_rights);
        if(holdingShort == true)
        {
            exchange.SetDirection('closesell');
            exchange.Buy(ticker.Sell+0.01,1);
        }
        exchange.SetDirection('buy');
        exchange.Buy(ticker.Sell + 0.01 ,1);
        holdingShort = false;
        holdingLong = true;
    }else if(signal == -1 && holdingShort == false)//做空
    {
        LogProfit(account.account_rights);
        if(holdingLong == true)
        {
            exchange.SetDirection('closebuy');
            exchange.Sell(ticker.Buy - 0.01,1);
        }
        exchange.SetDirection('sell');
        exchange.Sell(ticker.Buy- 0.01,1);
        holdingLong = false;
        holdingShort = true;
    }
    visuallize();
}
function main() {
    Log(exchange.GetAccount());
    exchange.SetContractType('quarter');
    while(true)
    {
        try
        {
            work();
        }
        catch(e)
        {
            Log(e.message)
        }
        //work();
        Sleep(1000)
    }
}
