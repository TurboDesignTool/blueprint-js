export class Version {
    static isVersionHigherThan(version, checkVersion) {
        if (version !== undefined) {
            checkVersion = checkVersion.replace(/[^\d.-]/g, '').split('.');
            const givenVersion = version.replace(/[^\d.-]/g, '').split('.');
            let flag = true;
            if (checkVersion.length !== givenVersion.length) {
                return false;
            }
            for (let i = 0; i < checkVersion.length; i++) {
                const a = parseInt(checkVersion[i]);
                const b = parseInt(givenVersion[i]);
                flag &= (a >= b);
            }
            return flag;

        }
        return false;
    }

    static getInformalVersion() {
        return '2.0.1a';
    }

    static getTechnicalVersion() {
        return '2.0.1a';
    }
}
