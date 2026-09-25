import { env } from '$env/dynamic/public';

export const API_BASE_URL = env.PUBLIC_CONCORDANS_API_BASE_URL || 'http://localhost:8000';
