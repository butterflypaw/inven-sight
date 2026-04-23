// src/services/api.js
import axios from "axios";

export const backendBaseUrl =
  process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

export const fetchDashboardStats = () =>
  axios.get(`${backendBaseUrl}/dashboard`);
export const fetchDetails = () => axios.get(`${backendBaseUrl}/details`);
export const fetchInventory = () => axios.get(`${backendBaseUrl}/inventory`);
export const checkBackendHealth = () => axios.get(`${backendBaseUrl}/health`);

export const registerUser = (username, password) =>
  axios.post(`${backendBaseUrl}/auth/register`, { username, password });

export const loginUser = (username, password) =>
  axios.post(`${backendBaseUrl}/auth/login`, { username, password });
