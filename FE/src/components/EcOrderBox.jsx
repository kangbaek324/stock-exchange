import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "./orderBox.css";


const EcOrderBox = ({ selectedAccount, setSelectedAccount, selectedStock }) => {
    const [selectMenu, setSelectMenu] = useState("edit");
    const [accountList, setAccountList] = useState([]);
    const [orderPrice, setOrderPrice] = useState(1);
    const [orderId, setOrderId] = useState(0);

    const [toast, setToast] = useState(null); 

    useEffect(() => {
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

        getAccountList();
    }, []);

    const submitOrder = useCallback(
        async (e) => {
            e.preventDefault();

            const editBody = {
                orderId: orderId,
                accountNumber: selectedAccount,
                price: orderPrice
            };

            try {
                if (selectMenu == "edit") {
                    setToast({ type: "success", text: "주문이 전송되었습니다"})
                    const res = await axios.put("http://localhost:3000/stocks/orders", editBody, {
                        withCredentials: true,
                    });
                    setToast({ type: "success", text: "✅ 주문이 성공적으로 접수되었습니다." });
                }
                else {
                    setToast({ type: "success", text: "주문이 전송되었습니다"})
                    const res = await axios.delete("http://localhost:3000/stocks/orders", {
                        data: {
                            orderId: orderId,
                            accountNumber: selectedAccount,
                        },
                        withCredentials: true,
                    });
                    setToast({ type: "success", text: "✅ 주문이 성공적으로 접수되었습니다." });
                }
            } catch (err) {
                console.error(err);
                setToast({ type: "error", text: "❌ 주문 처리 중 오류가 발생했습니다." });
            }

            setTimeout(() => setToast(null), 3000); 
        },
        [selectedAccount, orderPrice, orderId, selectMenu]
    );

    const topMenu = (
        <div>
            <span
                className={selectMenu === "edit" ? "selectMenu" : ""}
                onClick={() => setSelectMenu("edit")}
            >
                EDIT
            </span>
            <span
                className={selectMenu === "cancel" ? "selectMenu" : ""}
                onClick={() => setSelectMenu("cancel")}
            >
                CANCEL
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
                <p>주문번호</p>
                <input type="number" onChange={(e) => setOrderId(Number(e.target.value))} />

                <p>계좌</p>
                <select value={selectedAccount} onChange={(e) => setSelectedAccount(Number(e.target.value))}>
                    {accountList.map((account) => (
                        <option key={account} value={account}>
                            {account}
                        </option>
                    ))}
                </select>

                {selectMenu === "edit" && (
                    <>
                        <p>정정 가격</p>
                        <input
                            type="number"
                            value={orderPrice}
                            min={1}
                            onChange={(e) => setOrderPrice(Number(e.target.value))}
                        />
                    </>
                )}

                <input 
                    type="submit"
                    value="주문 접수"
                    style={{ marginTop: selectMenu === "cancel" ? "187px" : "127px" }}
                />
            </form>

        </>
    );
}

export default EcOrderBox;