/**
 * Test SMTP Script
 */
const nodemailer = require('nodemailer');

async function test() {
    console.log('--- بدء تجربة الإرسال ---');

    // استخدام أول حساب متوفر
    const account = {
        email: "info@tryallygen.com",
        pass: "mfsm zcqf gqmj xhbm",
        host: "smtp.gmail.com",
        port: 465,
        secure: true
    };

    const transporter = nodemailer.createTransport({
        host: account.host,
        port: account.port,
        secure: account.secure,
        auth: {
            user: account.email,
            pass: account.pass
        }
    });

    try {
        console.log(`جاري محاولة الإرسال عبر: ${account.email}...`);
        const info = await transporter.sendMail({
            from: `"تجربة مرسل" <${account.email}>`,
            to: "rec@tryeverengine.com", // إرسال لحساب آخر من القائمة للتجربة
            subject: "رسالة تجريبية من نظام مرسل الذكي",
            text: "هذه رسالة تجريبية للتأكد من عمل نظام الإرسال والـ SMTP بنجاح.",
            html: "<b>هذه رسالة تجريبية</b> للتأكد من عمل نظام الإرسال والـ SMTP بنجاح."
        });

        console.log('✅ تم الإرسال بنجاح!');
        console.log('معرف الرسالة:', info.messageId);
    } catch (error) {
        console.error('❌ فشل الإرسال:', error.message);
        if (error.message.includes('Invalid login')) {
            console.log('💡 تنبيه: تأكد من أن كلمة المرور هي App Password وليست كلمة مرور الحساب العادية.');
        }
    }
}

test();
