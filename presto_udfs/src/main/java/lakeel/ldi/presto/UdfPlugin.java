package lakeel.ldi.presto;


import com.google.common.collect.ImmutableSet;
import io.prestosql.spi.Plugin;
import lakeel.ldi.presto.functions.TransJapCalendar;


import java.util.Set;

public class UdfPlugin implements Plugin {
        @Override
        public Set<Class<?>> getFunctions()
        {
            return ImmutableSet.<Class<?>>builder()
                    .add(TransJapCalendar.class)
                    .build();
        }
}