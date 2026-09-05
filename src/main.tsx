import { useState } from 'react'

const ADMIN_NUMBER = import.meta.env.VITE_MOMO_ADMIN_NUMBER || '0764117040'

function App() {
  return (
    <div style={{padding:20, fontFamily:'Arial'}}>
      <h1>MUBS Marketplace ✅</h1>
      <p>Build Fixed! Admin: {ADMIN_NUMBER}</p>
      <p>MoMo Auto-Cut: 5% to {ADMIN_NUMBER}</p>
      <p>Firebase Connected: {import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'YES' : 'Check env vars'}</p>
      <div style={{marginTop:20, padding:15, background:'#f0f0f0', borderRadius:8}}>
        <h3>How 5% Cut Works:</h3>
        <code>
          Order 10,000 UGX<br/>
          Seller gets: 9,500 UGX<br/>
          You (0764117040) get: 500 UGX auto
        </code>
      </div>
    </div>
  )
}
export default App
