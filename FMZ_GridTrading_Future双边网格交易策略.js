

var position_long = [];
var cover_long = [];
var position_short = [];
var cover_short = [];
var center = -1;//当前参考中轴
var centerNow = -1;
//可修改参数
var amount;
var priceInterval;
var orderAmount;
//可视化参数
var account;
var cover_long_times = 0;
var cover_short_times = 0;
var stopLoss_times = 0;
var error_flag = -1;
var reload = false;//重新加载
function findNewCenter()
{
    var records = exchange.GetRecords(PERIOD_M1);
    //Log('records',records);
    if (records && records.length > 9) {
        var ema = TA.EMA(records, 9)          // K线bar 数量满足指标计算周期。
        //Log('ema',ema[ema.length-1]);
        //center = ema[ema.length-1];
        return ema[ema.length-1];
    }
}
function putGridOrders(CENTER)
{
    Log('New center:',CENTER,'reputing orders');
    position_long = [];
    position_short = [];
    cover_long = [];
    cover_short = [];
    var temp;
    for(var i = 1 ; i <= orderAmount; i++)
    {
        exchange.SetDirection('buy');
        //temp = exchange.Buy(CENTER + (priceInterval * i) ,amount * i);//加马丁
        temp = exchange.Buy(_N(CENTER - (priceInterval * i),4) ,amount );//不加马丁
        //Log(temp);
        position_long.push(temp);
        cover_long.push(-1);//保证数据对称
        exchange.SetDirection('sell');
        //temp = exchange.Sell(CENTER - (priceInterval * i) +0.5,amount * i);
        temp = exchange.Sell(_N(CENTER + (priceInterval * i),4) ,amount);
        position_short.push(temp);
        cover_short.push(-1);
        Sleep(200);
    }
    Sleep(1007);
    for(var i = 0 ; i < orderAmount ;i++)
    {
        position_long[i] = exchange.GetOrder(position_long[i]);
        position_short[i] = exchange.GetOrder(position_short[i]);
        Sleep(500);
    }
}
function upDateOrders()
{
    for(var i = 0 ;i < orderAmount;i++)
    {
        if(position_long[i] != -1)
        {
            position_long[i] = _C(exchange.GetOrder,position_long[i].Id);
        }
        if(cover_long[i] != -1)
        {
            cover_long[i] = _C(exchange.GetOrder,cover_long[i].Id);
        }
        if(position_short[i] != -1)
        {
            position_short[i] = _C(exchange.GetOrder,position_short[i].Id);
        }
        if(cover_short[i] != -1)
        {
            cover_short[i] = _C(exchange.GetOrder,cover_short[i].Id);
        }
        Sleep(200);
    }
}
//{"Info":{"order_id":2167939869745153,"status":0,"lever_rate":20,"fee":0,"contract_name":"EOS0329","type":1,"deal_amount":0,"price":1.82,"symbol":"eos_usd","amount":1,"unit_amount":10,"price_avg":0,"create_date":1547816137000},"Id":2167939869745153,"Amount":1,"Price":1.82,"DealAmount":0,"AvgPrice":0,"Status":0,"Type":0,"ContractType":"quarter"}
function checkOrders()
{
    error_flag = 'checkOrders 1';
    upDateOrders();
    for(var i = 0; i <orderAmount;i++)
    {
        if(position_long[i]!=-1 && position_long[i].Status == ORDER_STATE_CLOSED)
        {//当前开多仓位 已成交 设置平多点
            Log('当前开多仓位 已成交 设置平多点');
            exchange.SetDirection('closebuy');
            cover_long[i] = exchange.Sell( _N(position_long[i].Price + priceInterval,4),position_long[i].Amount);
            Sleep(300);//等待交易所返回挂单数据，否则查询为空
            cover_long[i] = _C(exchange.GetOrder,cover_long[i]);
            position_long[i] = -1;
        }
        if(position_short[i]!=-1 && position_short[i].Status == ORDER_STATE_CLOSED)
        {//当前开空仓位 已成交 设置平空点
            Log('当前开空仓位 已成交 设置平空点');
            exchange.SetDirection('closesell');
            cover_short[i] = exchange.Buy(_N(position_short[i].Price - priceInterval,4),position_short[i].Amount);
            Sleep(300);
            cover_short[i] = _C(exchange.GetOrder,cover_short[i]);
            position_short[i] = -1;
        }
        Sleep(507);
    }
    Sleep(307);
    error_flag = 'checkOrders 2';
    upDateOrders();
    for(var i = 0; i <orderAmount;i++)
    {
        if(cover_long[i]!=-1 && cover_long[i].Status == ORDER_STATE_CLOSED)
        {//平多仓位 已成交 重新设置开多仓位
            cover_long_times++;
            Log('平多仓位 已成交 重新设置开多仓位  当前成功平多次数:',cover_long_times); 
            LogProfit(_N(account.account_rights,4));
            exchange.SetDirection('buy');
            position_long[i] = exchange.Buy(_N(cover_long[i].Price - priceInterval,4),cover_long[i].Amount);
            Sleep(300);
            position_long[i] = _C(exchange.GetOrder,position_long[i]);
            cover_long[i] = -1;
        }
        if(cover_short[i]!=-1 && cover_short[i].Status == ORDER_STATE_CLOSED)
        {//平空仓位 已成交 重新设置开空点
            cover_short_times++;
            Log('平空仓位 已成交 重新设置开空点  当前成功平空次数:',cover_short_times);
            LogProfit(_N(account.account_rights,4));
            exchange.SetDirection('sell');
            position_short[i] = exchange.Sell(_N(cover_short[i].Price + priceInterval,4),cover_short[i].Amount);
            Sleep(300);
            position_short[i] = _C(exchange.GetOrder,position_short[i]);
            cover_short[i] = -1;
        }
        Sleep(507);
    }
}
function init()
{
    if(reload == true)
    {
        LogProfitReset();
        LogReset();
    }
    exchange.SetContractType('quarter');
    center = findNewCenter();
    account = _C(exchange.GetAccount).Info.info.eos;
}

function checkStopLoss()
{
    centerNow = findNewCenter();
    if(centerNow > center + orderAmount*priceInterval *1.2 || centerNow < center - orderAmount*priceInterval * 1.2)//EMA价格移动破当前网格极限1.2倍 触发止损
    {//触发止损
        Log('触发止损! 已触发次数:',++stopLoss_times);
        //撤销所有挂单
        var orders = _C(exchange.GetOrders);
        for(var i in orders)
        {
            exchange.CancelOrder(orders[i].Id,orders[i]);
            Sleep(500);
        }
        //平掉当前所有仓位
        //var info = exchange.GetPosition();
        var ticker = _C(exchange.GetTicker);
        /*for(var i in info)
        {
            if(info[i].Type == 0)//持有多仓
            {
                exchange.SetDirection('closebuy');
                exchange.Sell(ticker.Buy-0.2,info[i].Amount);
            }
            if(info[i].Type == 1)//持有空仓
            {
                exchange.SetDirection('closesell');
                exchange.Buy(ticker.Sell+0.2,info[i].Amount);
            }
        }*/
        if(centerNow < center)
        {
            exchange.SetDirection('closebuy');
            exchange.Sell(ticker.Buy-0.01,amount * orderAmount);
        }
        if(centerNow > center)
        {
            exchange.SetDirection('closesell');
            exchange.Buy(ticker.Sell+0.01,amount * orderAmount);
        }
        center = centerNow; //重设中轴
        Log('中轴重设为:',center);
        putGridOrders(center);
        return true;
    }
    return false;
}
function visuallize()
{
    var table = { 
        type: 'table', 
        title: '持仓信息', 
        cols: ['初始余额', '当前余额', '穿网低价','穿网高价','交易中轴','当前中轴'], 
        rows: [ 
            [initAmount,_N(account.account_rights,4),_N(center-1.2*priceInterval*orderAmount,4),_N(center+1.2*priceInterval*orderAmount,4),_N(center,4),_N(centerNow,4)],
            ['最后更新时间',_D(),'利润',_N(account.account_rights-initAmount,4),'收益率',_N((account.account_rights-initAmount)*100/initAmount,4)+'%'+'#FF0000'],
            ['策略交流','qq:825997808','wechat:Patricklee1019','email:patricklee981019@gmail.com','telegram:@CryptoPat1019',''],
        ]
    }; 
    LogStatus('`' + JSON.stringify(table) + '`');
}
function work()
{
    if(checkStopLoss())return ;
    account = _C(exchange.GetAccount).Info.info.eos;
    checkOrders();
    visuallize();
}
function main() {
    init();
    Log(exchange.GetAccount());
    putGridOrders(center);
    //Log(position_long);
    //Log(position_short);
    while(true)
    {
        try{
            work();
        }
        catch(e)
        {
            Log('error_flag:',error_flag,e,e.message);
        }
        Sleep(3007)
    }
}
