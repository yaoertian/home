package lakeel.ldi.presto.functions;

import io.airlift.slice.Slice;
import io.airlift.slice.Slices;
import io.prestosql.spi.function.Description;
import io.prestosql.spi.function.ScalarFunction;
import io.prestosql.spi.function.SqlType;
import io.prestosql.spi.type.StandardTypes;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.time.*;
import java.time.chrono.*;


import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class TransJapCalendar {
    private static String[] DATE_FORMATS = {"yyyy-MM-dd","GGGGy年M月d日"};

    @ScalarFunction("trans_jap_calendar")
    @Description("Translate Japanese Calendar between Gregorian calendar")
    @SqlType(StandardTypes.VARCHAR)
    public static Slice transJapCalender(@SqlType(StandardTypes.VARCHAR) Slice input, @SqlType(StandardTypes.VARCHAR) Slice type)
    {
        String dateString = input.toStringUtf8();
        String transType = type.toStringUtf8();
        String ret = "";
        try {
            Locale locale = new Locale("ja", "JP", "JP");
            //
            if ("0".equals(transType)){
                // 西暦 ->  和暦
                DateFormat normalFmt = new SimpleDateFormat(DATE_FORMATS[0]);
                Date dt = normalFmt.parse(dateString);
                DateFormat jpFmt = new SimpleDateFormat(DATE_FORMATS[1], locale);
                ret =  jpFmt.format(dt);
            } else {
                // 和暦 -> 西暦
                Calendar calendar = Calendar.getInstance(locale);
                DateFormat jpFmt = new SimpleDateFormat(DATE_FORMATS[1], locale);
                calendar.setLenient(false);
                Date dt = jpFmt.parse(dateString);
                DateFormat normalFmt = new SimpleDateFormat(DATE_FORMATS[0]);
                ret = normalFmt.format(dt);
            }
        } catch (Exception e){
           ret = null;
        }
        return Slices.utf8Slice(ret);
    }

}
