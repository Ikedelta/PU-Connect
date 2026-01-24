import emailjs from '@emailjs/browser';

/**
 * Sends an email using EmailJS.
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://www.emailjs.com/ and sign up (free).
 * 2. Add an Email Service (e.g., Gmail). Note the Service ID.
 * 3. Create an Email Template. Note the Template ID.
 *    - In the template, use variables like {{subject}}, {{heading}}, {{body}}, {{cta_text}}, {{cta_link}}.
 *    - IMPORTANT: Set "From Name" in the template to "Campus Connect" or use {{from_name}}.
 * 4. Get your Public Key from Account > API Keys.
 * 5. Update the constants below or use Environment Variables.
 */

// REPLACE THESE WITH YOUR ACTUAL EMAILJS KEYS
const SERVICE_ID = 'service_rhy606j'; // Updated from user request
const TEMPLATE_ID = 'template_campus_connect'; // Example: template_abc
const PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Example: user_123456

export interface EmailData {
    to_email: string;
    to_name?: string;
    subject: string;
    heading: string;
    body: string;
    cta_text?: string;
    cta_link?: string;
    image_url?: string;
}

export const sendEmail = async (data: EmailData) => {
    try {
        // If keys are missing, we simulate a send for development
        if (PUBLIC_KEY === 'YOUR_PUBLIC_KEY') {
            console.warn('⚠️ EmailJS keys not configured in src/lib/email.ts');
            console.log('📧 SIMULATED EMAIL SEND:', data);
            await new Promise(resolve => setTimeout(resolve, 1500)); // Fake delay
            return { status: 200, text: 'Simulated OK' };
        }

        const templateParams = {
            to_email: data.to_email,
            to_name: data.to_name || 'User',
            from_name: 'Campus Konnect', // Hardcoded sender name
            subject: data.subject,
            heading: data.heading,
            message: data.body, // 'body' might need to be mapped to 'message' depending on template
            cta_text: data.cta_text,
            cta_link: data.cta_link,
            image_url: data.image_url,
            reply_to: 'campuskonnect11@gmail.com' // Optional
        };

        const response = await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            templateParams,
            PUBLIC_KEY
        );

        return response;
    } catch (error) {
        console.error('Email Send Error:', error);
        throw error;
    }
};
