import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post('http://localhost:3000/auth/signup', {
        username,
        password,
        email
      });
      alert("회원가입이 완료되었습니다")
      navigate("/signin")
    } catch (error) {
      alert("회원가입 실패 : " + error.response.data.message)
    }
  };

  const style = {
    marginLeft: "10px"
  }
  
  return (
    <form onSubmit={handleSignup}>
      <p style={style}>stock</p>
      <input
        type="text"
        placeholder="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br />
      <br />
      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <br />
      <input 
        type="text"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <br />
      <input type="submit" value="회원가입" />
      <br />
      <a href="/signin" style={style}>Go Signin</a>
      <a href="/account" style={style}>Go New account</a>
    </form>
  );
};

export default Signup;
