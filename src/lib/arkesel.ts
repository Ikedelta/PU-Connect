import { supabase } from './supabase';

const API_KEY = import.meta.env.VITE_ARKESEL_API_KEY || 'RHNPVVNWaU5uYW1hcllVVXJvZlY';

export const sendSMS = async (
    recipients: string[],
    message: string,
    trigger?: 'otp' | 'news' | 'seller_reg' | 'seller_approval' | 'order_updates' | 'welcome' | 'role_update' | 'admin_promo' | 'subscription',
    placeholders?: Record<string, string>
) => {
    try {
        // 1. Check Global/Specific Toggle from platform_settings
        const settingKey = trigger ? `sms_enabled_${trigger}` : 'enable_sms';

        // Fetch setting
        const { data: platformSetting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', settingKey)
            .maybeSingle();

        const isEnabled = platformSetting
            ? platformSetting.value === true
            : true;

        if (!isEnabled) {
            console.log(`🚫 SMS Blocked: Feature '${settingKey}' is disabled in settings.`);
            return { success: true, status: 'skipped', message: `SMS disabled for ${settingKey}` };
        }

        // 2. Fetch Template if trigger is provided
        let finalMessage = message;
        if (trigger) {
            const { data: templateSetting } = await supabase
                .from('platform_settings')
                .select('value')
                .eq('key', `sms_template_${trigger}`)
                .maybeSingle();

            if (templateSetting && templateSetting.value) {
                let templateText = String(templateSetting.value);
                if (placeholders) {
                    Object.entries(placeholders).forEach(([key, val]) => {
                        templateText = templateText.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
                    });
                }
                finalMessage = templateText;
            }
        }

        // Final Global Safety Check from website_settings
        const { data: websiteSettings } = await supabase
            .from('website_settings')
            .select('enable_sms')
            .maybeSingle();

        if (websiteSettings && websiteSettings.enable_sms === false) {
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
                message: finalMessage,
                recipients: recipients,
            }),
        });
        const result = await response.json();

        // Log to activity_logs
        try {
            await supabase.from('activity_logs').insert({
                action_type: 'sms_sent',
                action_details: {
                    trigger: trigger || 'manual',
                    recipients: recipients,
                    message: finalMessage,
                    recipient_count: recipients.length
                }
            });
        } catch (logErr) {
            console.error('Failed to log SMS activity:', logErr);
        }

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
