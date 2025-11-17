import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    const AUTH_URLS = {
      prod: "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
      uat: "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
    };
    const PAY_URLS = {
      prod: "https://api.phonepe.com/apis/pg/checkout/v2/pay",
      uat: "https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay",
    };

    const { PHONEPE_CLIENT_ID, PHONEPE_CLIENT_VERSION, PHONEPE_CLIENT_SECRET, PHONEPE_ENV, APP_URL } = process.env;

    // 🟢 Get OAuth Token
    const authRes = await axios.post(
      AUTH_URLS[PHONEPE_ENV],
      new URLSearchParams({
        client_id: PHONEPE_CLIENT_ID,
        client_version: PHONEPE_CLIENT_VERSION,
        client_secret: PHONEPE_CLIENT_SECRET,
        grant_type: "client_credentials",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const token = authRes.data.access_token;
    const { amount } = req.body;

    if (!amount) return res.status(400).json({ error: "Amount required" });

    const merchantOrderId = "ORD_" + Date.now();
    const payload = {
      merchantOrderId,
      amount: amount * 100,
      expireAfter: 1200,
      paymentFlow: {
        type: "PG_CHECKOUT",
        message: "Order Payment",
        merchantUrls: {
          redirectUrl: `${APP_URL}/payment-status.html?merchantOrderId=${merchantOrderId}`,
        },
      },
    };

    // 🟣 Send Pay Request
    const payRes = await axios.post(PAY_URLS[PHONEPE_ENV], payload, {
      headers: {
        Authorization: `O-Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    console.log("PhonePe payRes data:", payRes.data);

    const redirectUrl =
      payRes.data.redirectUrl ||
      payRes.data.data?.redirectUrl ||
      payRes.data.data?.instrumentResponse?.redirectInfo?.url ||
      null;

    if (!redirectUrl) {
      console.error("Missing redirectUrl in PhonePe response:", payRes.data);
      throw new Error("Missing redirectUrl in PhonePe response");
    }

    res.status(200).json({ paymentUrl: redirectUrl, merchantOrderId });
  } catch (err) {
    console.error("💥 create-payment error:", err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
}
