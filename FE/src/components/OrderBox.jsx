import "./orderBox.css"

const OrderBox = (props) => {
    return (
        <form className="orderBox">
            <span>{props.optionName1}</span>
            <span>{props.optionName2}</span>
            <p>종목명(종목코드)</p>
            <input type="text" />
            <p>계좌</p>
            <input type="text" />
            <p>주문 수량</p>
            <input type="text" />
            <p>주문 가격</p>
            <input type="text" />
            <p>주문 유형</p>
            <select name="" id="">
                <option value="">시정가</option>
                <option value="">지정가</option>
            </select>
            <input type="submit" value="주문 접수" />
        </form>
    )
}

export default OrderBox;