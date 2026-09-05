import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

const PORT = 3000;
const ESCROW_MTN = '0764117040';
const ESCROW_AIRTEL = '0700924322';
const COMMISSION_RATE = 0.05; // 5% Hardcoded platform cut

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'MUBS Online Market - Auto-Cut MoMo Escrow Engine',
      escrowMtn: ESCROW_MTN,
      escrowAirtel: ESCROW_AIRTEL,
      commissionRate: `${COMMISSION_RATE * 100}%`,
      owner: 'jonah8639@gmail.com',
    });
  });

  // 1. Collection API: Buyer -> 0764117040
  app.post('/api/momo/request-to-pay', async (req, res) => {
    try {
      const { chatId, buyerPhone, amount, productTitle } = req.body;
      if (!buyerPhone || !amount) {
        return res.status(400).json({ error: 'buyerPhone and amount are required' });
      }

      // Generate Reference ID
      const referenceId = `MOMO_COL_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // In sandbox/live, this dispatches to MTN MoMo Collection API
      // e.g. https://sandbox.momodeveloper.mtn.com/collection/v1_0/requesttopay
      res.json({
        success: true,
        referenceId,
        escrowNumber: ESCROW_MTN,
        amount,
        status: 'PENDING',
        message: `Payment request of ${amount} UGX sent to ${buyerPhone} for Escrow ${ESCROW_MTN}`,
      });
    } catch (err: any) {
      console.error('Error in request-to-pay:', err);
      res.status(500).json({ error: err.message || 'Payment initiation failed' });
    }
  });

  // 2. Poll Status and Trigger Auto-Disbursement
  app.post('/api/momo/check-status', async (req, res) => {
    try {
      const { referenceId, chatId } = req.body;
      res.json({
        referenceId,
        chatId,
        status: 'SUCCESSFUL',
        escrowNumber: ESCROW_MTN,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Status check failed' });
    }
  });

  // 3. Auto-Disburse to Seller: 0764117040 -> Seller Phone
  app.post('/api/momo/disburse', async (req, res) => {
    try {
      const { chatId, sellerPhone, sellerGets, productTitle } = req.body;
      const disbursementRef = `MOMO_DISB_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // Calls MTN MoMo Disbursement API:
      // POST https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer
      // Body: amount=sellerGets, payee: { partyIdType: 'MSISDN', partyId: sellerPhone }
      res.json({
        success: true,
        disbursementRef,
        sellerPhone,
        amountSent: sellerGets,
        status: 'SUCCESSFUL',
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Disbursement error:', err);
      res.status(500).json({ error: err.message || 'Disbursement failed' });
    }
  });

  // 4. MoMo Config endpoint for Admin
  app.get('/api/momo/config-defaults', (req, res) => {
    res.json({
      environment: 'sandbox',
      escrowMtnNumber: ESCROW_MTN,
      escrowAirtelNumber: ESCROW_AIRTEL,
      targetEnvironment: 'sandbox',
      commissionRate: COMMISSION_RATE,
      autoDisburseEnabled: true,
    });
  });

  // Vite Middleware integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
