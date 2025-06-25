import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";

const Signin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post('http://localhost:3000/auth/signin', {
        username,
        password,
      });
      alert("로그인에 성공하였습니다");
      navigate("/stock")
    } catch (error) {
      alert("로그인 실패: " + error.message)
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
      <input type="submit" value="로그인" />
      <br />
      <a href="/signup" style={style}>Go Signup</a>
    </form>
  );
};

export default Signin;
