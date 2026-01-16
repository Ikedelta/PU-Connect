import { supabase } from './supabase';

const API_KEY = import.meta.env.VITE_ARKESEL_API_KEY || 'RHNPVVNWaU5uYW1hcllVVXJvZlY';

export const sendSMS = async (recipients: string[], message: string) => {
    try {
        // Check Global Toggle
        const { data: settings } = await supabase
            .from('website_settings')
            .select('enable_sms')
            .single();

        if (settings && settings.enable_sms === false) {
            console.log('🚫 SMS Blocked: Feature is disabled globally in settings.');
            return { success: true, status: 'skipped', message: 'SMS disabled globally' };
        }

        const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
            method: 'POST',
            headers: {
                'api-key': API_KEY,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: 'CampConnect',
                message: message,
                recipients: recipients,
            }),
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Arkesel SMS Error:', error);
        return { success: false, error };
    }
};

export const getSMSBalance = async () => {
    try {
        // Updated to the correct V2 balance-details endpoint
        const response = await fetch('https://sms.arkesel.com/api/v2/clients/balance-details', {
            method: 'GET',
            headers: {
                'api-key': API_KEY,
            },
        });

        if (!response.ok) {
            console.error('Arkesel API Check Failed:', response.statusText);
            return 0;
        }

        const result = await response.json();
        console.log('Arkesel Balance Response:', result);

        // V2 Response Structure: { status: "success", data: { sms_balance: "2000", ... } }
        if (result.data) {
            if (result.data.sms_balance !== undefined) return Number(result.data.sms_balance);
            if (result.data.sms_unit !== undefined) return Number(result.data.sms_unit);
            if (result.data.balance !== undefined) return Number(result.data.balance);
        }

        // V1 Fallback: { balance: 100, ... }
        if (result.balance !== undefined) return Number(result.balance);

        return 0;
    } catch (error) {
        console.error('Arkesel Balance Network Error:', error);
        return 0;
    }
};
