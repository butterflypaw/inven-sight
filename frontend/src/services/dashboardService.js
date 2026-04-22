import axios from "axios";

const API_URL = "http://localhost:5000"; // URL of your json-server

export const getDashboardStats = async () => {
  try {
    const response = await axios.get(`${API_URL}/dashboard`);
    return response.data;
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return null;
  }
};
