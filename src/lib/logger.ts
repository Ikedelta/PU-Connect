import { supabase } from './supabase';

export const logActivity = async (
    userId: string,
    actionType: string,
    details: any
) => {
    try {
        const { error } = await supabase.from('activity_logs').insert({
            user_id: userId,
            action_type: actionType,
            action_details: details,
        });

        if (error) {
            console.error('Failed to log activity:', error);
        }
    } catch (err) {
        console.error('Error logging activity:', err);
    }
};
