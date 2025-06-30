import "./account.css"

const Account = ({ accountData }) => {
    if (accountData == null) return;
    let myStock = [];
    let totalBuyAmount = 0;
    let totalEvaluationAmount = 0;
    let totalPnL = 0;

    for(let i = 0; i < accountData.length - 1; i++) {
        const per = ((accountData[i].nowPrice - accountData[i].average) / accountData[i].average * 100).toFixed(2)
        let perColorStyle;
        if (per > 0) {
            perColorStyle = "redText";
        } 
        else if (per < 0) {
            perColorStyle = "blueText"
        }
        else {
            perColorStyle = "blackText"
        }

        const EvaluationAmount = accountData[i].nowPrice * accountData[i].amount;
        const PnL = EvaluationAmount - parseInt(accountData[i].totalBuyAmount);
        const prefix = per > 0 ? "+" : per < 0 ? "" : "-";  
        
        totalBuyAmount += parseInt(accountData[i].totalBuyAmount);
        totalEvaluationAmount += EvaluationAmount;
        totalPnL += PnL 

        myStock.push(
            <tr>
                <td>{accountData[i].name}</td>
                <td className={perColorStyle}>{prefix}{per}%</td>
                <td>{PnL}원</td>
                <td>{accountData[i].average}원</td>
                <td>{accountData[i].amount}주</td>
                <td>{accountData[i].canAmount}주</td>
                <td>{accountData[i].nowPrice}원</td>
                <td>{accountData[i].totalBuyAmount}원</td>
                <td>{EvaluationAmount}원</td>
            </tr>
        )
    }

    return (
        <div>
            <div id="accountInfo">
                <div>
                    <div>총매입<p>{totalBuyAmount}원</p></div>
                    <div>총손익<p>{totalPnL}원</p></div>
                </div>
                <div>
                    <div>총평가<p>{totalEvaluationAmount}원</p></div>
                    <div>예수금<p>{accountData[accountData.length - 1].money}원</p></div>
                </div>
            </div>
            <hr />
            <div id="stockList" className="scroll-hidden">
                <table>
                    <tr>
                        <th>종목명</th>
                        <th>수익률</th>
                        <th>평가손익</th>
                        <th>매입가</th>
                        <th>보유수량</th>
                        <th>가능수량</th>
                        <th>현재가</th>
                        <th>매입금액</th>
                        <th>평가금액</th>
                    </tr>
                    {myStock}
                </table>
            </div>
        </div>
    );
};

export default Account;