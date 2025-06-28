import { useState } from "react";
import Account from "./account";
import OrderHistory from "./OrderHistory";
import OrderStatus from "./OrderStatus";
import "./my.css"

const My = ({ accountData }) => {
    const [menu, setMenu] = useState(0);
    const renderMenu = () => {
        switch(menu) {
            case 0:
                return <Account accountData={accountData}></Account>;
            case 1:
                return <OrderHistory></OrderHistory>;
            case 2:
                return <OrderStatus></OrderStatus>;
        }
    }
    return (
        <div id="account">
            <div id="menuBar">
                <p>잔고</p>
                <p>체결</p>
                <p>미체결</p>
            </div>
            <div id="menu">
                {renderMenu()}
            </div>
        </div>
    )
}

export default My;