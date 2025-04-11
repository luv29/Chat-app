import Mailgen from "mailgen";
import nodemailer from "nodemailer";
import logger from "../logger/winston.logger";

interface SendEmailOptions {
    email: string;
    subject: string;
    mailgenContent: Mailgen.Content;
}

// Function to send an email using nodemailer and mailgen
const sendEmail = async (options: SendEmailOptions): Promise<void> => {
    const mailGenerator = new Mailgen({
        theme: "default",
        product: {
            name: "Chat-app",
            link: "http://localhost:8000",
        },
    });

    const emailTextual = mailGenerator.generatePlaintext(options.mailgenContent);
    const emailHtml = mailGenerator.generate(options.mailgenContent);

    const transporter = nodemailer.createTransport({
        host: process.env.MAILTRAP_SMTP_HOST,
        port: Number(process.env.MAILTRAP_SMTP_PORT),
        auth: {
            user: process.env.MAILTRAP_SMTP_USER,
            pass: process.env.MAILTRAP_SMTP_PASS,
        },
    });

    const mailOptions = {
        from: "luvkansal29@gmail.com",
        to: options.email,
        subject: options.subject,
        text: emailTextual,
        html: emailHtml,
    };

    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        logger.error(
            "Email service failed silently. Make sure you have provided your MAILTRAP credentials in the .env file"
        );
        logger.error("Error: ", error);
    }
};

// Email verification content generator
const emailVerificationMailgenContent = (
    username: string,
    verificationUrl: string
): Mailgen.Content => {
    return {
        body: {
            name: username,
            intro: "Welcome to our app! We're very excited to have you on board.",
            action: {
                instructions: "To verify your email please click on the following button:",
                button: {
                    color: "#22BC66",
                    text: "Verify your email",
                    link: verificationUrl,
                },
            },
            outro: "Need help, or have questions? Just reply to this email, we'd love to help.",
        },
    };
};

// Forgot password content generator
const forgotPasswordMailgenContent = (
    username: string,
    passwordResetUrl: string
): Mailgen.Content => {
    return {
        body: {
            name: username,
            intro: "We got a request to reset the password of your account",
            action: {
                instructions: "To reset your password click on the following button or link:",
                button: {
                    color: "#22BC66",
                    text: "Reset password",
                    link: passwordResetUrl,
                },
            },
            outro: "Need help, or have questions? Just reply to this email, we'd love to help.",
        },
    };
};

export {
    sendEmail,
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent,
};