// import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
// import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// serve(async (req) => {
//   try {
//     const body = await req.text()
//     const signature = req.headers.get("x-paystack-signature")

//     const PAYSTACK_SECRET = Deno.env.get("PAYSTACK_SECRET_KEY")

//     // Verify signature
//     const hashBuffer = await crypto.subtle.digest(
//       "SHA-512",
//       new TextEncoder().encode(body)
//     )

//     const hashArray = Array.from(new Uint8Array(hashBuffer))
//     const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("")

//     if (hashHex !== signature) {
//       return new Response("Invalid signature", { status: 401 })
//     }

//     const event = JSON.parse(body)

//     if (event.event === "charge.success") {
//       const reference = event.data.reference
//       const email = event.data.customer.email

//       const supabase = createClient(
//         Deno.env.get("SUPABASE_URL")!,
//         Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
//       )

//       // Verify transaction with Paystack API
//       const verifyRes = await fetch(
//         `https://api.paystack.co/transaction/verify/${reference}`,
//         {
//           headers: {
//             Authorization: `Bearer ${PAYSTACK_SECRET}`
//           }
// //         }
// //       )

// //       const verifyData = await verifyRes.json()

// //       if (verifyData.data.status === "success") {
// //         await supabase
// //           .from("vendors")
// //           .update({
// //             subscription_status: "active",
// //             plan_tier: "premium"
// //           })
// //           .eq("email", email)
// //       }
// //     }

// //     return new Response("ok", { status: 200 })

// //   } catch (err) {
// //     return new Response("Server error", { status: 500 })
// //   }
// // })
