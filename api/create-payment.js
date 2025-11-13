import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

const AUTH_URLS = {
  prod: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
  uat: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token"
};
const PAY_URLS = {
  prod: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
  uat: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay"
};

async function getOAuthToken() {
  const { PHONEPE_CLIENT_ID, PHONEPE_CLIENT_VERSION, PHONEPE_CLIENT_SECRET, PHONEPE_ENV } = process.env;
  const res = await axios.post(
    AUTH_URLS[PHONEPE_ENV],
    new URLSearchParams({
      client_id: PHONEPE_CLIENT_ID,
      client_version: PHONEPE_CLIENT_VERSION,
      client_secret: PHONEPE_CLIENT_SECRET,
      grant_type: "client_credentials"
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data.access_token;
}

app.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount) return res.status(400).json({ error: "Amount required" });

    const token = await getOAuthToken();
    const merchantOrderId = "ORD_" + Date.now();

    const payload = {
      merchantOrderId,
      amount: amount * 100,
      expireAfter: 1200,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Order Payment",
        merchantUrls: {
          redirectUrl: `${process.env.APP_URL}/payment-status.html?merchantOrderId=${merchantOrderId}`
        }
      }
    };

    const payRes = await axios.post(PAY_URLS[process.env.PHONEPE_ENV], payload, {
      headers: {
        Authorization: `O-Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    res.json({
      paymentUrl: payRes.data.data.redirectUrl,
      merchantOrderId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
