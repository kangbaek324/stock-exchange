const NoExecutionOrder = ({ myOrderData }) => {
    let noExecutionOrderList = [];
    for(let i = 0; i < myOrderData.noExecutionOrder.length; i++) {
        if (myOrderData.noExecutionOrder[i]) {
            noExecutionOrderList.push(
                <tr>
                    <td>{myOrderData.noExecutionOrder[i].id}</td>
                    <td>{myOrderData.noExecutionOrder[i].stockName}</td>
                    <td>{myOrderData.noExecutionOrder[i].tradingType == "buy" ? "매수" : "매도"}</td>
                    <td>{myOrderData.noExecutionOrder[i].price}</td>
                    <td>{myOrderData.noExecutionOrder[i].number}</td>
                    <td>{myOrderData.noExecutionOrder[i].matchNumber}</td>
                </tr>
            );
        }
    }
    return (
        <div>
            <table>
                <tr>
                    <th>주문번호</th>
                    <th>종목명</th>
                    <th>구분</th>
                    <th>주문가</th>
                    <th>주문량</th>
                    <th>체결량</th>
                </tr>
                {noExecutionOrderList}
            </table>
        </div>
    );
};

export default NoExecutionOrder;