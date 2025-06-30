import { useState, useEffect } from "react";
import Account from "./account";
import ExecutionOrder from "./ExecutionOrder"
import NoExecutionOrder from "./NoExecutionOrder"
import axios from "axios";
import "./my.css"

const My = ({ accountData, changeAccount, selectedAccount, setSelectedAccount, myOrderData, setMyOrderData }) => {
    const [selectedMenu, setSelectedMenu] = useState(0);
    const [accountList, setAccountList] = useState([]);

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

    const renderMenu = () => {
        switch(selectedMenu) {
            case 0:
                return <Account accountData={accountData}></Account>;
            case 1:
                return <ExecutionOrder accountData={accountData} myOrderData={myOrderData}></ExecutionOrder>;
            case 2:
                return <NoExecutionOrder accountData={accountData} myOrderData={myOrderData}></NoExecutionOrder>;
        }
    }

    return (
        <div id="account">
            <div id="menuBar">
                <p className={selectedMenu == 0 ? "selectMenu" : ""} onClick={() => setSelectedMenu(0)}>잔고</p>
                <p className={selectedMenu == 1 ? "selectMenu" : ""} onClick={() => setSelectedMenu(1)}>체결</p>
                <p className={selectedMenu == 2 ? "selectMenu" : ""} onClick={() => setSelectedMenu(2)}>미체결</p>
                <p>현재계좌:</p>
                <select value={selectedAccount} onChange={(e) => { 
                    setSelectedAccount(e.target.value)
                    changeAccount(e.target.value)
                } }>
                    {accountList.map((account) => (
                        <option key={account} value={account}>
                            {account}
                        </option>
                    ))}
                </select>
            </div>
            <div id="menu">
                {renderMenu()}
            </div>
        </div>
    )
}

export default My;