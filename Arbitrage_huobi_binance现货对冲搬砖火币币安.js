var chart = { // 这个 chart 在JS 语言中 是对象， 在使用Chart 函数之前我们需要声明一个配置图表的对象变量chart。
    __isStock: true,                                    // 标记是否为一般图表，有兴趣的可以改成 false 运行看看。
    tooltip: {xDateFormat: '%Y-%m-%d %H:%M:%S, %A'},    // 缩放工具
    title : { text : '差价分析图'},                       // 标题
    rangeSelector: {                                    // 选择范围
        buttons:  [{type: 'hour',count: 1, text: '1h'}, {type: 'hour',count: 3, text: '3h'}, {type: 'hour', count: 8, text: '8h'}, {type: 'all',text: 'All'}],
        selected: 0,
        inputEnabled: false
    },
    xAxis: { type: 'datetime'},                         // 坐标轴横轴 即：x轴， 当前设置的类型是 ：时间
    yAxis : {                                           // 坐标轴纵轴 即：y轴， 默认数值随数据大小调整。
        title: {text: '差价'},                           // 标题
        opposite: false,                                // 是否启用右边纵轴
    },
    series : [                                          // 数据系列，该属性保存的是 各个 数据系列（线， K线图， 标签等..）
        {name : "huobi -> binance", id : "A->B", data : []},  // 索引为0， data 数组内存放的是该索引系列的 数据
        {name : "binance -> huobi", id : "B->A", data : []}, // 索引为1，设置了dashStyle : 'shortdash' 即：设置 虚线。
        {name : "0线", id : "0", data : []},
        {name : "手续费", id : "fees", data : []},
        {name : "可套利差价", id : "makeProfit", data : []},
    ]
};
var depthA,depthB;
var timeBegin,timeEnd;
var askPriceA,bidPriceA,askAmountA,bidAmountA;
var askPriceB,bidPriceB,askAmountB,bidAmountB;
var minAmount = 20;//最小下单量
var feeA = 0.0020;//huobi 手续费0.2%，如果有点卡根据自己点卡价格修改
var feeB = 0.0008;//binance 手续费 0.075%
var fees ;
var minProfit = 0.0004;//最小利润
var diff_A,diff_B;
var notDealAmountA,notDealAmountB;
var accountA,accountB;
var initAccountA,initAccountB;
var maxDeltaAmount= 100;//最大可容忍币偏差，币偏差数量超过这个值将触发平衡逻辑
var dealAmountA=0;
var dealAmountB=0;
var safeAmount = 800;//安全最大成交量
var checkBalanceCount=60;//撤单检查时间
var profit;
var maxTime = 150;//最大延迟过滤
var accountBNB;
var reload = false;
var websocketMode = false;
function init()
{
    
    try{
        fees = feeA + feeB;
        if(websocketMode)
        {
            exchanges[0].IO("websocket");
            exchanges[1].IO("websocket");
        }
        else 
        {
            exchanges[0].IO("rest");
            exchanges[1].IO("rest");
        }
        
        initAccountA = _G("initAccountA");
        initAccountB = _G("initAccountB");
        if(initAccountA == null || initAccountB == null)
        {
            initAccountA = _C(exchanges[0].GetAccount);
            initAccountB = _C(exchanges[1].GetAccount);
            _G("initAccountA",initAccountA);
            _G("initAccountB",initAccountB);
            Log("账号初值初始化成功");
        }
        else
        {
            Log("继承初值数据成功");
        }
        accountA = initAccountA;
        accountB = initAccountB;
        //Log('huobi',accountA);
        //Log('binance',accountB);
        
    }
    catch(e)
    {
        Log("初始化失败 请重启",e.message);
    }
}
   
function legalizeDepth()
{
    askPriceA = askPriceB = askAmountA = askAmountB = bidPriceA = bidPriceB = bidAmountA = bidAmountB = 0;
    //Log(depthA.Asks);
    for(var i in depthA.Asks)
    {
        askPriceA = depthA.Asks[i].Price;
        askAmountA += depthA.Asks[i].Amount;
        if(askAmountA >= minAmount)break;
    }
    for(var i in depthA.Bids)
    {
        bidPriceA = depthA.Bids[i].Price;
        bidAmountA += depthA.Bids[i].Amount;
        if(bidAmountA >= minAmount)break;
    }
    for(var i in depthB.Asks)
    {
        askPriceB = depthB.Asks[i].Price;
        askAmountB += depthB.Asks[i].Amount;
        if(askAmountB >= minAmount)break;
    }
    for(var i in depthB.Bids)
    {
        bidPriceB = depthB.Bids[i].Price;
        bidAmountB = depthB.Bids[i].Amount;
        if(bidAmountB >= minAmount)break;
    }
}
function cancelAllOrders()
{
    var orders = _C(exchanges[0].GetOrders);
    for(var i in orders)
    {
        var infoA = exchanges[0].CancelOrder(orders[i].Id);
        Log("成交:",orders[i].DealAmount,"未成交:",orders[i].Amount - orders[i].DealAmount);
        dealAmountA -= orders[i].Amount - orders[i].DealAmount;
    }
    orders = _C(exchanges[1].GetOrders);
    for(var i in orders)
    {
        var infoB = exchanges[1].CancelOrder(orders[i].Id);
        Log("成交:",orders[i].DealAmount,"未成交:",orders[i].Amount - orders[i].DealAmount);
        dealAmountB -= orders[i].Amount - orders[i].DealAmount;
    }
    orders = _C(exchanges[2].GetOrders);
    for(var i in orders)
    {
        var infoB = exchanges[2].CancelOrder(orders[i].Id);
    }
    
    if(checkBNB())return true;
}
function checkBNB()
{
    accountBNB = exchanges[2].GetAccount();
    var tickerBNB = exchanges[2].GetTicker();
    if(accountBNB.Stocks < 1)
    {
        exchanges[2].Buy(tickerBNB.Sell,1);
        return true;
    }
    return false;
}
function checkBalance()
{
    cancelAllOrders();
    var deltaStocks = initAccountA.Stocks + initAccountA.FrozenStocks + initAccountB.Stocks + initAccountB.FrozenStocks-(accountA.Stocks+accountA.FrozenStocks+accountB.Stocks+accountB.FrozenStocks);
    deltaStocks = _N(deltaStocks,0);
    
    if(deltaStocks < -maxDeltaAmount)//仓位过重
    {
      //  Log("仓位过重 需要减仓 deltaStocks =", deltaStocks);
        if(askPriceA > askPriceB && accountA.Stocks >-deltaStocks)
        {//如果A交易所价格比B交易所高
            exchanges[0].Sell(askPriceA,-deltaStocks);
            dealAmountA+= -deltaStocks;
        }
        else
        {
            exchanges[1].Sell(askPriceB,-deltaStocks);
            dealAmountB += -deltaStocks;
        }
        return true;
    }
    if(deltaStocks > maxDeltaAmount)
    {
      //  Log("仓位过轻 需要加仓 deltaStocks =", deltaStocks);
        if(bidPriceA < bidPriceB && accountA.Balance*0.999 / bidPriceA > deltaStocks)
        {
            exchanges[0].Buy(bidPriceA,deltaStocks);
            dealAmountA += deltaStocks;
        }
        else 
        {
            exchanges[1].Buy(bidPriceB,deltaStocks);
            dealAmountB+=deltaStocks;
        }
        return true;
    }
    
    return false;
    
}
function upDateProfit()
{
    
    profit =accountA.Balance+accountB.Balance+accountA.FrozenBalance+accountB.FrozenBalance+(accountA.Stocks+accountA.FrozenStocks+accountB.Stocks+accountB.FrozenStocks - initAccountA.Stocks-initAccountA.FrozenStocks-initAccountB.Stocks-initAccountB.FrozenStocks)*askPriceA  - (initAccountA.Balance+initAccountA.FrozenBalance+initAccountB.Balance+initAccountB.FrozenBalance);
    return profit;
}
function checkOpportunity()
{
    diff_A = bidPriceB - askPriceA;//huobi 买 -> binance 卖
    diff_B = bidPriceA - askPriceB;//binance 买 -> huobi 卖diff_B
    var amount = 0;
    var maxBuyAmount = 0;
    var maxSellAmount = 0;
    var tempA,tempB;
    if(diff_A > 0 && diff_A > (minProfit + fees)*askPriceA)//够手续费 且 够最小利润
    {
        
        maxBuyAmount =Math.min(accountA.Balance / askPriceA * 0.98,askAmountA);
        maxSellAmount = Math.min(accountB.Stocks,bidAmountB);
        amount = Math.min(maxBuyAmount,maxSellAmount);
        amount = Math.min(amount,safeAmount);
        amount = _N(amount,0);
        
        if(amount < minAmount)
        {
         //   Log("可用余额小于最低下单量");
            return;
        }
        Log("huobi -> binance",amount);
        tempA = exchanges[0].Go("Buy",askPriceA,amount);
        tempB = exchanges[1].Go("Sell",bidPriceB,amount);
        tempA.wait();
        tempB.wait();
        Sleep(3000);
        dealAmountA+=amount;
        dealAmountB+=amount;
        accountA = _C(exchanges[0].GetAccount);
        accountB = _C(exchanges[1].GetAccount);
        LogProfit(upDateProfit());
    }
    if(diff_B > 0 && diff_B > (minProfit + fees)*askPriceB)
    {
        maxBuyAmount = Math.min(accountB.Balance / askPriceB *0.98,askAmountB);
        maxSellAmount = Math.min(accountA.Stocks,bidAmountA);
        amount = Math.min(maxBuyAmount,maxSellAmount);
        amount = Math.min(amount,safeAmount);
        amount = _N(amount,0);
        
        if(amount < minAmount)
        {
           // Log("可用余额小于最低下单量");
            return;
        }
        Log("binance -> huobi",amount);
        tempA = exchanges[0].Go("Sell",bidPriceA,amount);
        tempB = exchanges[1].Go("Buy",askPriceB,amount);
        tempA.wait();
        tempB.wait();
        Sleep(3000);
        dealAmountA+=amount;
        dealAmountB+=amount;
        accountA = _C(exchanges[0].GetAccount);
        accountB = _C(exchanges[1].GetAccount);
        LogProfit(upDateProfit());
    }
}
function main() {
    if(reload == true)
    {
        initAccountA = _C(exchanges[0].GetAccount);
        initAccountB = _C(exchanges[1].GetAccount);
        _G("initAccountA",initAccountA);
        _G("initAccountB",initAccountB);
    }
    init();
    var ObjChart = Chart(chart);  // 调用 Chart 函数，初始化 图表。
    ObjChart.reset();             // 清空
    while(true)
    {
        try{
            accountA = exchanges[0].GetAccount();
            accountB = exchanges[1].GetAccount();
            timeBegin = new Date().getTime();
            depthA = exchanges[0].Go("GetDepth");
            depthB = exchanges[1].Go("GetDepth");
            depthA = depthA.wait();
            depthB = depthB.wait();
            timeEnd = new Date().getTime();
            if(timeEnd - timeBegin > maxTime)continue;//延迟超过maxTime ms就放弃当组数据
            if(depthA == null || depthB == null || accountA == null || accountB == null)continue;
            
            legalizeDepth();
            if(checkBalanceCount >= 60)
            {
                checkBalanceCount = 0;
                if(checkBalance())continue;
            }
            else checkBalanceCount += 1;
           
            checkOpportunity();
            
            //数据可视化操作
            var table = { 
                type: 'table', 
                title: '持仓操作', 
                cols: ['交易所','初始余额','初始币数','当前余额','当前币数','成交量'], 
                rows: [ 
                    ['huobi',initAccountA.Balance+initAccountA.FrozenBalance,initAccountA.Stocks+initAccountA.FrozenStocks,accountA.Balance+accountA.FrozenBalance,accountA.Stocks+accountA.FrozenStocks,dealAmountA],
                    ['binance',initAccountB.Balance+initAccountB.FrozenBalance,initAccountB.Stocks+initAccountB.FrozenStocks,accountB.Balance+accountB.FrozenBalance,accountB.Stocks+accountB.FrozenStocks,dealAmountB],
                    ['合计',initAccountA.Balance+initAccountB.Balance,initAccountA.Stocks+initAccountB.Stocks,accountA.Balance+accountA.FrozenBalance+accountB.Balance+accountB.FrozenBalance,accountA.Stocks+accountA.FrozenStocks+accountB.Stocks+accountB.FrozenStocks,dealAmountA+dealAmountB],
                    ['huobi盘口',askPriceA,askAmountA,bidPriceA,bidAmountA,''],
                    ['binance盘口',askPriceB,askAmountB,bidPriceB,bidAmountB,''],
                    ['收益:',_N(upDateProfit(),8)+'#FF0000','BNB数量',_N(accountBNB.Stocks,4),'','',''],
                    ['收益率',_N(100*profit/(initAccountA.Balance+initAccountA.FrozenBalance+initAccountB.Balance+initAccountB.FrozenBalance),6)+'%'+'#FF0000','','','','',''],
                    ['总延迟',timeEnd - timeBegin,'','','','',''],
                    ['最后更新时间',_D(),'','','','',''],
                    
                    ]
                }; 
            LogStatus('`' + JSON.stringify(table) + '`') 
            ObjChart.add([0,[timeEnd,diff_A]]);
            ObjChart.add([1,[timeEnd,diff_B]]);
            ObjChart.add([2,[timeEnd,0]]);
            ObjChart.add([3,[timeEnd,fees*askPriceA]]);
            ObjChart.add([4,[timeEnd,(fees+minProfit)*askPriceA]]);
            ObjChart.update(chart);
            Sleep(317);
        }
        catch(e)
        {
            Log(e.message);
        }
    }
    
}
