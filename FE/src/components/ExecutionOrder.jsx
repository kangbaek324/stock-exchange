const ExecutionOrder = ({ myOrderData }) => {
    let executionOrderList = [];
    for(let i = 0; i < 10; i++) {
        if (myOrderData.executionOrder[i]) {
            executionOrderList.push(
                <tr>
                    <td>{myOrderData.executionOrder[i].id}</td>
                    <td>{myOrderData.executionOrder[i].stockName}</td>
                    <td>{myOrderData.executionOrder[i].tradingType == "buy" ? "매수" : "매도"}</td>
                    <td>{myOrderData.executionOrder[i].price}</td>
                    <td>{myOrderData.executionOrder[i].number}</td>
                    <td>{myOrderData.executionOrder[i].matchNumber}</td>
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
                {executionOrderList}
            </table>
        </div>
    );
};

export default ExecutionOrder;