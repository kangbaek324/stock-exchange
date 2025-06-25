import { useNavigate } from "react-router-dom";
import axios from "axios";

const Account = () => {
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();

        try {
            await axios.post('http://localhost:3000/stocks/account', {}, { withCredentials: true });
            alert("계좌개설이 완료되었습니다");
            navigate("/stock")
        } catch (error) {
            alert("계좌개설실패: " + error);
        }
    };

    const style = {
        marginLeft: "10px"
    }
  
    return (
        <div>
            <form onSubmit={handleSignup}>
                <input type="submit" value="New Account" />
                <br />
                <a href="/signup" style={style}>Go Signup</a>
            </form>
        </div>
    );
}

export default Account;