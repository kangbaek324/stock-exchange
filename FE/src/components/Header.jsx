import "./header.css"
import Stock from "../img/Stock.png"

const Header = ({ stockData }) => {
    if (!stockData) return null;

    const current = stockData.stockInfo.price;
    const previous = stockData.previousClose?.close ?? stockData.stockInfo.price;
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(2);

    let colorClass = "neutral";
    let arrow = "-"; 

    if (diff > 0) {
        colorClass = "up";  
        arrow = "▲";
    } else if (diff < 0) {
        colorClass = "down";
        arrow = "▼";
    }

    return (
        <div className="header">
            <div id="stockInfo">
                <img src={Stock} alt="" />
                <p id="stockName">{stockData.stockInfo.name}</p>
                <p id="stockPrice" className={colorClass}>{current}</p> 
                <p id="stockArray" className={colorClass}>{arrow}</p>
                <p id="variablePrice" className={colorClass}>{diff.toFixed(0)}</p>
                <p id="variablePer" className={colorClass}>
                    {percentChange > 0 ? "+" : percentChange < 0 ? "" : ""}{percentChange}%
                </p>
            </div>
        </div>
    );
}

export default Header;
