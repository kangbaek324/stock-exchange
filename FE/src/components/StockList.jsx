import "./stockList.css"
import stock from "../img/Stock.png"

const StockList = () => {
    return (
        <div id="stocks">
            <div className="stock">
                <img src={stock} alt="" />
                <p>문경테크놀로지</p>
            </div>

            <div className="stock">
                <img src={stock} alt="" />
                <p>은수에어로스페이스</p>
            </div>
            <div className="stock">
                <img src={stock} alt="" />
                <p>환성물산</p>
            </div>
        </div>
    )
}

export default StockList;