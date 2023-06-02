import { BASE_URL } from "@/src/constants";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<string>
) {
  const goServerResp = await fetch(`${BASE_URL}/healthz`, {
    credentials: 'same-origin',
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "GET",
  });
  const data: Promise<string> = await goServerResp.json();
  res.status(200).send(JSON.stringify(data));
}