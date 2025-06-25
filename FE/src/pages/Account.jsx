import { useState } from "react";
import { useNavigate } from "react-router-dom";

const Account = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();

        try {
            const response = await axios.post('http://localhost:3000/auth/signup', {
                username,
                password,
            });
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