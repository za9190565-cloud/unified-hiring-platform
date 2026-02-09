/**
 * Dynamic Subject Generator
 * Logic: Rotates through different themes and ensures no repetition within 24h.
 */

class SubjectGenerator {
    constructor(policy) {
        this.policy = policy || { max_repetition: 5, reset_hours: 24 };
        this.history = new Map(); // subject_hash -> { count, last_used }

        this.templates = {
            administrative: [
                "إشعار بخصوص طلب التوظيف",
                "تنويه إداري – استكمال إجراء",
                "تحديث بخصوص حالة الطلب"
            ],
            personal_indirect: [
                "تمت مراجعة طلبكم",
                "إفادة بخصوص بيانات التقديم",
                "بخصوص طلبكم الأخير"
            ],
            neutral_safe: [
                "متابعة إجراء",
                "تحديث حالة الطلب",
                "إشعار بخصوص البيانات"
            ]
        };

        this.contexts = ["اليوم", "هذا الأسبوع", "المرحلة الحالية"];
    }

    /**
     * Generates a new unique subject based on the rules.
     */
    generate(type = 'administrative') {
        const pool = this.templates[type] || this.templates['neutral_safe'];
        let subject = pool[Math.floor(Math.random() * pool.length)];

        // Add contextual randomness
        const context = this.contexts[Math.floor(Math.random() * this.contexts.length)];
        subject = `${subject} (${context})`;

        if (this._isAllowed(subject)) {
            this._recordUsage(subject);
            return subject;
        } else {
            // Fallback or retry logic if subject limit hit
            return this.generate('neutral_safe');
        }
    }

    _isAllowed(subject) {
        const entry = this.history.get(subject);
        if (!entry) return true;

        const now = Date.now();
        const isStale = (now - entry.last_used) > (this.policy.reset_hours * 3600 * 1000);

        if (isStale) {
            this.history.delete(subject);
            return true;
        }

        return entry.count < this.policy.max_repetition;
    }

    _recordUsage(subject) {
        const entry = this.history.get(subject) || { count: 0, last_used: Date.now() };
        entry.count++;
        entry.last_used = Date.now();
        this.history.set(subject, entry);
    }
}

module.exports = SubjectGenerator;
