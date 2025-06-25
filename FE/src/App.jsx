import { Route, Routes } from 'react-router'
import Signin from './pages/Signin'
import Signup from './pages/Signup'
import Stock from './pages/Stock'
import Account from './pages/Account'

function App() {
  return (
    <Routes>
      <Route path='/' element={<Signup />}></Route>
      <Route path='/signin' element={<Signin></Signin>}></Route>
      <Route path='/signup' element={<Signup></Signup>}></Route>
      <Route path='/stock' element={<Stock></Stock>}></Route>
      <Route path='/account' element={<Account></Account>}></Route>
    </Routes>
  )
}

export default App
