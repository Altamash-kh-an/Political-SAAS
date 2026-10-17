import { adminRequest } from "./adminDataService";

export async function loadWorkspaceRecords(accessToken) {
  const [panchayats, booths, voters] = await Promise.all([
    adminRequest("/workspace/panchayats", accessToken),
    adminRequest("/workspace/booths", accessToken),
    adminRequest("/workspace/voters", accessToken),
  ]);

  return { panchayats, booths, voters };
}
