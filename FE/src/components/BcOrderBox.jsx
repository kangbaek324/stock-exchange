import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./orderBox.css";

const BcOrderBox = ({ selectedAccount, setSelectedAccount, selectedStock, setSelectedStock }) => {
    const [selectMenu, setSelectMenu] = useState("buy");
    const [stockList, setStockList] = useState([]);
    const [accountList, setAccountList] = useState([]);
    const [orderNumber, setOrderNumber] = useState(1);
    const [orderPrice, setOrderPrice] = useState(1);
    const [orderType, setOrderType] = useState("시장가");

    const [toast, setToast] = useState(null); 

    useEffect(() => {
        const getStockList = async () => {
            try {
                const res = await axios.get("http://localhost:3000/stocks/info");
                setStockList(res.data);
                setSelectedStock(res.data[0].id);
            } catch (err) {
                console.log(err);
            }
        };

        const getAccountList = async () => {
            try {
                const res = await axios.get("http://localhost:3000/stocks/account", {
                    withCredentials: true,
                });
                setAccountList(res.data);
                setSelectedAccount(res.data[0]);
            } catch (err) {
                console.log(err);
            }
        };

        getStockList();
        getAccountList();
    }, []);

    const submitOrder = useCallback(
        async (e) => {
            e.preventDefault();

            const body = {
                accountNumber: Number(selectedAccount),
                stockId: Number(selectedStock),
                price: Number(orderPrice),
                number: Number(orderNumber),
                orderType: orderType === "시장가" ? "market" : "limit",
            };

            try {
                const res = await axios.post(`http://localhost:3000/stocks/orders/${selectMenu}`, body, {
                    withCredentials: true,
                });
                console.log(res)
                setToast({ type: "success", text: "✅ 주문이 성공적으로 접수되었습니다." });
            } catch (err) {
                console.error(err);
                setToast({ type: "error", text: "❌ 주문 처리 중 오류가 발생했습니다." });
            }

            setTimeout(() => setToast(null), 3000);
        },
        [selectedAccount, selectedStock, orderPrice, orderNumber, orderType, selectMenu]
    );

    const topMenu = (
        <div>
            <span
                className={selectMenu === "buy" ? "selectMenu" : ""}
                onClick={() => setSelectMenu("buy")}
            >
                BUY
            </span>
            <span
                className={selectMenu === "sell" ? "selectMenu" : ""}
                onClick={() => setSelectMenu("sell")}
            >
                SELL
            </span>
        </div>
    );

    return (
        <>
            {toast && (
                <div className={`toast ${toast.type}`}>
                    {toast.text}
                </div>
            )}

            <form className="orderBox" onSubmit={submitOrder}>
                {topMenu}
                <p>종목명(종목코드)</p>
                <select value={selectedStock} onChange={(e) => setSelectedStock(e.target.value)}>
                    {stockList.map((stock) => (
                        <option key={stock.id} value={stock.id}>
                            {stock.name}
                        </option>
                    ))}
                </select>

                <p>계좌</p>
                <select value={selectedAccount} onChange={(e) => setSelectedAccount(e.target.value)}>
                    {accountList.map((account) => (
                        <option key={account} value={account}>
                            {account}
                        </option>
                    ))}
                </select>

                <p>주문 수량</p>
                <input
                    type="number"
                    value={orderNumber}
                    min={1}
                    onChange={(e) => setOrderNumber(Number(e.target.value))}
                />

                <p>주문 가격</p>
                <input
                    type="number"
                    value={orderPrice}
                    min={1}
                    onChange={(e) => setOrderPrice(Number(e.target.value))}
                />

                <p>주문 유형</p>
                <select value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                    <option value="시장가">시장가</option>
                    <option value="지정가">지정가</option>
                </select>

                <input type="submit" value="주문 접수" />
            </form>
        </>
    );
};

export default BcOrderBox;
