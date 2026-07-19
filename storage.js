/* ==========================
   SOFT SPACE STORAGE
========================== */

const Storage = {

    load(key, fallback = []) {

        const data = localStorage.getItem(key);

        return data ? JSON.parse(data) : fallback;

    },

    save(key, value) {

        localStorage.setItem(key, JSON.stringify(value));

    }

};