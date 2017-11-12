;(function($) {
    'use strict';

    function stop(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    var TABLES = [];

    var pluginName = 'tableEditCompare',
        defaults = {
            'save': function(data) {
                console.dir(data);
            },
            'dataProviders': {},
            'dataValidators': {}
        };

    function Plugin(element, options) {
        this.options    = $.extend({}, defaults, options);
        this.$element   = $(element);
        this.identifier = this.$element.data('identifier');
        this.init();
    }

    Plugin.MESSAGE_TYPES = {
        'ERROR': 0,
        'INFO': 1,
        'SUCCESS': 2
    };

    Plugin.prototype.selectCell = function(event) {
        stop(event);
        var $el = $(event.target);

        $el.closest('tr').children('td').removeClass('selected');
        $el.closest('td').addClass('selected');
    };

    Plugin.prototype.selectColumn = function(event) {
        stop(event);
        var $el = $(event.target);
        var col = $el.data('column');

        var $tbody = $el.closest('tbody');

        $tbody.find('td.tec-data-cell')
            .removeClass('selected');

        $tbody.find('td.tec-data-cell:nth-of-type(' + col + ')')
            .addClass('selected');
    };

    Plugin.prototype.toggleEditing = function(event) {
        stop(event);

        var $a = $(event.target).closest('a');
        var $td = $a.closest('tr').find('td.selected');
        if ($td.length === 0) {
            return;
        }

        if ($a.hasClass('editing')) {
            this.updateCellText($td);
        }

        $a.toggleClass('editing');
        $td.toggleClass('editing');
    };

    Plugin.prototype.updateCellText = function($td) {
        var $inputs = $td.find('.cell-inputs .tec-input');
        var $spans = $td.find('.cell-data span[data-field]');

        if ($spans.length === 0) {
            $td.find('.cell-data').text($inputs[0].value);
            return;
        }

        for (var i = 0; i < $inputs.length; i++) {
            $($spans[i]).text($inputs[i].value);
        }
    };

    Plugin.prototype.save = function(event) {
        stop(event);

        this.clearTableMessages();

        var data = this.getData();
        if (this.belongsToAGroup()) {
            var groupHasError = false;
            data = {};
            for (var i = 0; i < TABLES.length; i++) {
                var table = TABLES[i];
                table.clearTableMessages();

                data[table.identifier] = table.getData();
                if (!table.allFieldsAreSelected()) {
                    groupHasError = true;
                    table.setTableMessage(
                        'bad! select all the things',
                        Plugin.MESSAGE_TYPES.ERROR
                    );
                }
            }
            if (groupHasError) {
                return;
            }
        }

        if (!this.allFieldsAreSelected()) {
            this.setTableMessage(
                'bad! select all the things',
                Plugin.MESSAGE_TYPES.ERROR
            );
            return;
        }

        if (typeof this.options.save === 'function') {
            this.options.save(data);
        }
    };

    Plugin.prototype.clearTableMessages = function() {
        this.$element.find('.tec-error-message').remove();
    };

    Plugin.prototype.getMessageClassByType = function(type) {
        if (typeof type === 'undefined') {
            return 'info';
        }

        switch (type) {
            case Plugin.MESSAGE_TYPES.ERROR:
                return 'error';
            case Plugin.MESSAGE_TYPES.SUCCESS:
                return 'success';
            case Plugin.MESSAGE_TYPES.INFO:
                return 'info';
            default:
                return 'info';
        }
    };

    Plugin.prototype.setTableMessage = function(message, type) {
        var msgClass = this.getMessageClassByType(type);
        var $errBody = $('<tbody class="tec-error-message"><tr class="' + msgClass + '"><th colspan="3">' + message + '</th></tr></tbody>').hide();
        this.$element.prepend($errBody);
        $errBody.slideDown();
    };

    Plugin.prototype.setFieldMessage = function(field, message, type) {
        if (typeof type === 'undefined') {
            type = Plugin.MESSAGE_TYPES.INFO;
        }
    };

    Plugin.prototype.allFieldsAreSelected = function() {
        var rowCount = this.$element.find('td.tec-data-cell').length / 2;
        var $selected = this.$element.find('td.tec-data-cell.selected');
        return (rowCount === $selected.length);
    };

    Plugin.prototype.getData = function() {
        var data = {};
        this.$element.children('tbody').each(function(idx, tbody) {
            var $tbody = $(tbody);
            var tbodyField = $tbody.data('field');
            if (typeof tbodyField !== 'undefined') {
                data[tbodyField] = {};
            }

            var $inputs = $tbody.find('td.tec-data-cell.selected .cell-inputs .tec-input');
            $inputs.each(function(idx, input) {
                if (typeof tbodyField === 'undefined') {
                    data[input.name] = input.value;
                } else {
                    data[tbodyField][input.name] = input.value;
                }
            });
        });
        return data;
    };

    Plugin.prototype.init = function() {
        this.$element.children('tbody').each(function(idx, tbody) {
            this.setupDataCells($(tbody));
            this.setupLabelCells($(tbody));
            this.addButtonRows($(tbody));
        }.bind(this));

        this.addSaveRow();
        this.addEventHandlers();
        this.setupGrouping();
    };

    Plugin.prototype.setupDataCells = function($tbody) {
        var $cells = $tbody.find('td');

        $cells.each(function(idx, td) {
            var $td = $(td);

            var fieldNames = [];
            var fieldVals = [];

            var $spans = $td.find('span[data-field]');
            if ($spans.length === 0) {
                fieldNames.push($td.closest('[data-field]').data('field'));
                fieldVals.push($td.text());
            } else {
                $spans.each(function(unused, span) {
                    var $span = $(span);
                    fieldNames.push($span.data('field'));
                    fieldVals.push($span.text());
                });
            }

            var $inputWrapper = $('<div class="cell-inputs"></div>');
            for (var i = 0; i < fieldNames.length; i++) {
                var $input;
                if (this.hasDataProvider(fieldNames[i])) {
                    $input = this.buildSelectInput(fieldNames[i], fieldVals[i]);
                } else {
                    $input = this.buildTextInput(fieldNames[i], fieldVals[i]);
                }
                $inputWrapper.append($input);
            }

            $td.addClass('tec-data-cell')
                .wrapInner('<div class="cell-data"></div>')
                .append($inputWrapper);
        }.bind(this));
    };

    Plugin.prototype.hasDataProvider = function(name) {
        return typeof this.options.dataProviders[name] === 'function';
    };

    Plugin.prototype.getDataProvider = function(name) {
        return this.options.dataProviders[name];
    };

    Plugin.prototype.buildTextInput = function(fieldName, value) {
        return $('<input/>', {
            'type': 'text',
            'name': fieldName,
            'value': value,
            'class': 'tec-input'
        });
    };

    Plugin.prototype.buildSelectInput = function(fieldName, value) {
        var $select = $('<select/>', {
            'name': fieldName,
            'class': 'tec-input'
        });
        var options = this.getDataProvider(fieldName)();
        var values = Object.keys(options);
        for (var i = 0; i < values.length; i++) {
            var val = values[i];
            var text = options[val];

            var selected = (val === value) ? ' selected' : '';
            var $option = $('<option value="' + val + '"' + selected + '>' + text + '</option>');
            $select.append($option);
        }

        return $select;
    };

    Plugin.prototype.setupLabelCells = function($tbody) {
        $tbody.find('th').each(function(idx, th) {
            var $child = $('<a class="field-row-edit"><span class="tec-edit">Edit</span><span class="tec-save">Done</span></a>');
            $(th).append($child);
        });
    };

    Plugin.prototype.addButtonRows = function($tbody) {
        var $selectAllTr = $('<tr><td>&nbsp;</td><td><button class="tec-select-all" data-column="1">Select All</button></td><td><button class="tec-select-all" data-column="2">Select All</button></td><td>&nbsp;</td></tr>');
        $tbody.append($selectAllTr);
    };

    Plugin.prototype.addSaveRow = function() {
        var $saveTr = $('<tfoot><tr><td>&nbsp;</td><td><button class="tec-save">Submit</button></td><td>&nbsp;</td><td>&nbsp;</td></tr></tfoot>');
        this.$element.append($saveTr);
    };

    Plugin.prototype.addEventHandlers = function() {
        this.$element.on('click', 'td.tec-data-cell, td.tec-data-cell > *', this.selectCell);
        this.$element.on('click', 'button.tec-select-all', this.selectColumn.bind(this));
        this.$element.on('click', '.field-row-edit', this.toggleEditing.bind(this));
        this.$element.on('click', 'button.tec-save', this.save.bind(this));
    };

    Plugin.prototype.belongsToAGroup = function() {
        return (typeof this.identifier !== 'undefined');
    };

    Plugin.prototype.setupGrouping = function() {
        if (this.belongsToAGroup()) {
            TABLES.push(this);
            if (TABLES.length > 1) {
                TABLES[(TABLES.length - 2)].removeSaveButton();
            }
        }
    };

    Plugin.prototype.removeSaveButton = function() {
        this.$element.children('tfoot').remove();
    };

    $.fn.tableEditCompare = function(options) {
        return this.each(function() {
            if (!$.data(this, 'plugin_' + pluginName)) {
                $.data(this, 'plugin_' + pluginName, new Plugin(this, options));
            }
        });
    };
})(jQuery);
