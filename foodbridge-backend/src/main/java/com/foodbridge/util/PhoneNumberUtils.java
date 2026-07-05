package com.foodbridge.util;

public final class PhoneNumberUtils {

    private PhoneNumberUtils() {
    }

    public static String normalizeIndianMobile(String phone) {
        if (phone == null) {
            return "";
        }
        String digits = phone.replaceAll("\\D", "");
        return digits.length() <= 10 ? digits : digits.substring(digits.length() - 10);
    }
}
