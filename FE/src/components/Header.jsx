import "./header.css"
import Stock from "../img/Stock.png"

const Header = () => {
    return (
        <div className="header">
            <div id="stockInfo">
                <img src={Stock} alt="" />
                <p id="stockName">문경테크놀로지</p>
                <p id="stockPrice">9600</p>
                <p id="stockArray">▲</p>
                <p id="variablePrice">100</p>
                <p id="VariablePer">+1.05%</p>
            </div>
        </div>
    )
}

export default Header;