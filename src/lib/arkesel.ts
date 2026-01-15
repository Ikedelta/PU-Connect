export const sendSMS = async (recipients: string[], message: string) => {
    const apiKey = 'RHNPVVNWaU5uYW1hcllVVXJvZlY';
    try {
        const response = await fetch('https://sms.arkesel.com/api/v2/sms/send', {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sender: 'PU Connect',
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
    const apiKey = 'RHNPVVNWaU5uYW1hcllVVXJvZlY';
    try {
        const response = await fetch('https://sms.arkesel.com/api/v2/clients/balance', {
            method: 'GET',
            headers: {
                'api-key': apiKey,
            },
        });
        const result = await response.json();
        // Result format check (adapting to generic response structure)
        if (result.data) {
            // Return sms_unit if available, otherwise just return the numeric part of balance if it's a number
            return result.data.sms_unit !== undefined ? Number(result.data.sms_unit) : 0;
        }
        return 0;
    } catch (error) {
        console.error('Arkesel Balance Error:', error);
        return 0;
    }
};
