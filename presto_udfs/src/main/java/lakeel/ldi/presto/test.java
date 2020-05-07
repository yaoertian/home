package lakeel.ldi.presto;

import java.text.DateFormat;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.time.*;
import java.time.chrono.*;

import java.time.temporal.ChronoField;
import java.time.temporal.JulianFields;
import java.time.temporal.TemporalField;
import java.util.*;

public class test {


    private static String[] DATE_FORMATS = {"yyyy-MM-dd","GGGGy年M月d日"};
    public static void main(String[] args) throws ParseException {
//        Date date = new Date();
//        Calendar cl= Calendar.getInstance();
//        cl.setTime(date);
//        String input = "2018/11/14";
//        input = input.replace("/","").replace("-","");
//        Integer year = Integer.valueOf(input.substring(0,4));
//        Integer month = Integer.valueOf(input.substring(4,6));
//        Integer day = Integer.valueOf(input.substring(6,8));
//        System.out.println(year);
//        System.out.println(month);
//        System.out.println(day);
//
//
//        Locale locale = new Locale("ja", "JP", "JP");
//        DateFormat kanjiFormat = new SimpleDateFormat("GGGGy年M月d日", locale);
//
//        Calendar cal = Calendar.getInstance();
//        cal.clear();
//        // 改元前の日付出力
////        cal.set(2018, 9, 12, 23, 59, 59);
//
//        DateFormat inFmt = new SimpleDateFormat("yyyy-MM-dd", locale);
//        Date dt = inFmt.parse("2018-01-17");
//
//        Date lastHeiseiDate = cal.getTime();
//        String japCal = kanjiFormat.format(lastHeiseiDate);
//        System.out.println(japCal);
//        //
//        Calendar calendar = Calendar.getInstance(locale);
//        DateFormat jpFmt = new SimpleDateFormat("GGGGy年M月d日", locale);
//        String curalTime = "平成30年2月10日";
//        calendar.setLenient(false);
//        Date dt = null;
//        try {
//            dt = jpFmt.parse(curalTime);
//        } catch (ParseException e) {
//            // TODO 自動生成された catch ブロック
//            e.printStackTrace();
//        }
//        DateFormat engFmt = new SimpleDateFormat("yyyy-MM-dd");
//        System.out.println(dt);
//
//
//
//        //////////////////////  ==================================
//        Integer inputType = 0;
//        Integer outputType = 1;
//        // Calendarインスタンスを取得

        System.out.println(trans("2018-10-12",0));
        System.out.println(trans("平成30年2月10日",1));

//        System.out.println(asciiFormat.format(lastHeiseiDate));


//        JapaneseDate japanDate2 = JapaneseChronology.INSTANCE.date(LocalDate.of(year,month,day));
//        System.out.println(japanDate2.getEra());
//        System.out.println(japanDate2.get());
//
//        String output = japanDate2.toString();
//        System.out.println(output);

//        HijrahDate islamyDate = HijrahChronology.INSTANCE.date(LocalDate.of(cl.get(Calendar.YEAR),cl.get(Calendar.MONTH)+1, cl.get(Calendar.DATE)));
//        System.out.println(islamyDate);
//        JapaneseDate japanDate2 = JapaneseDate.INSTANCE.date(LocalDate.of(cl.get(Calendar.YEAR),cl.get(Calendar.MONTH)+1, cl.get(Calendar.DATE)));
//        System.out.println(japanDate2);
//        ThaiBuddhistDate taiDate3 = ThaiBuddhistChronology.INSTANCE.date(LocalDate.of(cl.get(Calendar.YEAR),cl.get(Calendar.MONTH)+1, cl.get(Calendar.DATE)));
//        System.out.println(taiDate3);
//        MinguoDate taiDate4 = MinguoChronology.INSTANCE.date(LocalDate.of(cl.get(Calendar.YEAR),cl.get(Calendar.MONTH)+1, cl.get(Calendar.DATE)));
//        System.out.println(taiDate4);
    }

    private static String trans(String dateString, Integer transType) throws ParseException {
        Locale locale = new Locale("ja", "JP", "JP");
        //
        if (transType == 0){
            // 西暦 ->  和暦
            DateFormat normalFmt = new SimpleDateFormat(DATE_FORMATS[0]);
            Date dt = normalFmt.parse(dateString);
            DateFormat jpFmt = new SimpleDateFormat(DATE_FORMATS[1], locale);
            return jpFmt.format(dt);
        } else {
             // 和暦 -> 西暦
            Calendar calendar = Calendar.getInstance(locale);
            DateFormat jpFmt = new SimpleDateFormat(DATE_FORMATS[1], locale);
            calendar.setLenient(false);
            Date dt = jpFmt.parse(dateString);
            DateFormat normalFmt = new SimpleDateFormat(DATE_FORMATS[0]);
            return normalFmt.format(dt);
        }
    }



}
